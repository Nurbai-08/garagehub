import math
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import jwt
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.db import get_session
from app.image_urls import validate_image_urls
from app.models import Car, CarImage, CarRating, Comment, CommunityMessage, Conversation, Favorite, Message, Post, PostLike, RefreshToken, ServiceRecord, User
from app.schemas import (
    CarCreate,
    CarOutput,
    CarUpdate,
    CommentCreate,
    CommentOutput,
    CommunityMessageOutput,
    ConversationOutput,
    LoginInput,
    MessageCreate,
    MessageOutput,
    OwnerCarOutput,
    PaginatedCars,
    PaginatedPosts,
    PostCreate,
    PostOutput,
    ProfileUpdate,
    PublicProfile,
    RatingInput,
    RatingOutput,
    RegisterInput,
    ServiceRecordInput,
    ServiceRecordOutput,
    ServiceRecordUpdate,
    ServiceStats,
    TokenOutput,
    UserOutput,
)
from app.security import create_token, current_user, hash_password, optional_user, token_digest, verify_password
from app.security_middleware import SecurityMiddleware
from app.storage import LocalImageStorage, image_storage

app = FastAPI(title=settings.app_name, version="0.1.0", docs_url=None if settings.is_production else "/docs")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
app.add_middleware(SecurityMiddleware, is_production=settings.is_production)
if isinstance(image_storage, LocalImageStorage):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


def car_output(car: Car, owner: str) -> CarOutput:
    image_urls = [image.image_url for image in car.images] or [car.cover_image_url]
    return CarOutput(
        id=car.id,
        brand=car.brand,
        model=car.model,
        year=car.year,
        power_hp=car.power_hp,
        drivetrain=car.drivetrain,
        mileage=car.mileage,
        cover_image_url=car.cover_image_url,
        image_urls=image_urls,
        description=car.description,
        generation=car.generation,
        trim=car.trim,
        is_public=car.is_public,
        owner_username=owner,
        rating_avg=float(car.rating_avg) / 10,
        rating_count=car.rating_count,
        favorites_count=car.favorites_count,
    )


def owner_car_output(car: Car, owner: str) -> OwnerCarOutput:
    return OwnerCarOutput(**car_output(car, owner).model_dump(), vin=car.vin)


def auth_response(user: User, response: Response, session: AsyncSession) -> tuple[TokenOutput, RefreshToken]:
    access = create_token(user.id, "access", timedelta(minutes=settings.access_token_expire_minutes))
    refresh = create_token(user.id, "refresh", timedelta(days=settings.refresh_token_expire_days))
    expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    response.set_cookie("refresh_token", refresh, httponly=True, secure=settings.is_production or settings.is_vercel, samesite="lax", max_age=settings.refresh_token_expire_days * 86400, path="/api/v1/auth")
    return TokenOutput(access_token=access, user=UserOutput.model_validate(user)), RefreshToken(user_id=user.id, token_hash=token_digest(refresh), expires_at=expires)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "garage-api"}


@app.post("/api/v1/auth/register", response_model=TokenOutput, status_code=201)
async def register(data: RegisterInput, response: Response, session: AsyncSession = Depends(get_session)) -> TokenOutput:
    exists = await session.scalar(select(User).where(or_(func.lower(User.email) == data.email.lower(), User.username == data.username)))
    if exists:
        raise HTTPException(status_code=409, detail={"code": "USER_EXISTS", "message": "Email или username уже используются"})
    user = User(email=data.email.lower(), username=data.username, password_hash=hash_password(data.password))
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Email или username уже используются") from None
    result, refresh = auth_response(user, response, session)
    session.add(refresh)
    await session.commit()
    return result


@app.post("/api/v1/auth/login", response_model=TokenOutput)
async def login(data: LoginInput, response: Response, session: AsyncSession = Depends(get_session)) -> TokenOutput:
    user = await session.scalar(select(User).where(func.lower(User.email) == data.email.lower()))
    if user is None or not user.is_active or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    result, refresh = auth_response(user, response, session)
    session.add(refresh)
    await session.commit()
    return result


@app.post("/api/v1/auth/refresh", response_model=TokenOutput)
async def refresh(request: Request, response: Response, session: AsyncSession = Depends(get_session)) -> TokenOutput:
    raw = request.cookies.get("refresh_token")
    if not raw:
        raise HTTPException(status_code=401, detail="Сессия истекла")
    try:
        payload = jwt.decode(raw, settings.jwt_secret, algorithms=["HS256"])
        stored = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_digest(raw), RefreshToken.revoked_at.is_(None)).with_for_update())
        user = await session.get(User, uuid.UUID(payload["sub"])) if payload.get("type") == "refresh" else None
    except (jwt.InvalidTokenError, KeyError, ValueError):
        user = None
        stored = None
    expires_at = stored.expires_at if stored else None
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if user is None or not user.is_active or stored is None or expires_at is None or expires_at < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Сессия истекла")
    stored.revoked_at = datetime.now(UTC)
    result, next_refresh = auth_response(user, response, session)
    session.add(next_refresh)
    await session.commit()
    return result


@app.post("/api/v1/auth/logout", status_code=204)
async def logout(request: Request, response: Response, session: AsyncSession = Depends(get_session)) -> None:
    raw = request.cookies.get("refresh_token")
    if raw:
        stored = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_digest(raw)))
        if stored:
            stored.revoked_at = datetime.now(UTC)
            await session.commit()
    response.delete_cookie("refresh_token", path="/api/v1/auth")


@app.get("/api/v1/auth/me", response_model=UserOutput)
async def me(user: User = Depends(current_user)) -> User:
    return user


@app.get("/api/v1/users/{username}", response_model=PublicProfile)
async def public_profile(username: str, session: AsyncSession = Depends(get_session)) -> PublicProfile:
    user = await session.scalar(select(User).where(User.username == username.lower()))
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    cars_count = int(await session.scalar(select(func.count(Car.id)).where(Car.owner_id == user.id, Car.is_public.is_(True))) or 0)
    posts_count = int(await session.scalar(select(func.count(Post.id)).join(Car).where(Post.author_id == user.id, Car.is_public.is_(True))) or 0)
    return PublicProfile(username=user.username, display_name=user.display_name, bio=user.bio, city=user.city, avatar_url=user.avatar_url, created_at=user.created_at, cars_count=cars_count, posts_count=posts_count)


@app.patch("/api/v1/users/me", response_model=UserOutput)
async def update_profile(data: ProfileUpdate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await session.commit()
    await session.refresh(user)
    return user


@app.get("/api/v1/cars", response_model=PaginatedCars)
async def cars(
    search: str | None = None,
    brand: str | None = None,
    year_from: int | None = Query(default=None, ge=1886),
    year_to: int | None = Query(default=None, ge=1886),
    power_from: int | None = Query(default=None, ge=0),
    power_to: int | None = Query(default=None, ge=0),
    drivetrain: str | None = None,
    sort: str = Query(default="newest", pattern="^(newest|rating|popular)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
    session: AsyncSession = Depends(get_session),
) -> PaginatedCars:
    query = select(Car, User.username).join(User).where(Car.is_public.is_(True))
    count_query = select(func.count(Car.id)).join(User).where(Car.is_public.is_(True))
    if search:
        term = f"%{search.strip()}%"
        condition = or_(Car.brand.ilike(term), Car.model.ilike(term), User.username.ilike(term))
        query = query.where(condition)
        count_query = count_query.where(condition)
    filters = []
    if brand:
        filters.append(func.lower(Car.brand) == brand.lower())
    if year_from is not None:
        filters.append(Car.year >= year_from)
    if year_to is not None:
        filters.append(Car.year <= year_to)
    if power_from is not None:
        filters.append(Car.power_hp >= power_from)
    if power_to is not None:
        filters.append(Car.power_hp <= power_to)
    if drivetrain:
        filters.append(Car.drivetrain == drivetrain)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)
    total = int(await session.scalar(count_query) or 0)
    order: ColumnElement[Any] = Car.created_at.desc()
    if sort == "rating":
        order = Car.rating_avg.desc()
    elif sort == "popular":
        order = Car.favorites_count.desc()
    rows = (await session.execute(query.order_by(order, Car.id).offset((page - 1) * page_size).limit(page_size))).all()
    return PaginatedCars(items=[car_output(car, username) for car, username in rows], page=page, page_size=page_size, total=total, total_pages=math.ceil(total / page_size) if total else 0)


@app.get("/api/v1/cars/brands", response_model=list[str])
async def car_brands(session: AsyncSession = Depends(get_session)) -> list[str]:
    result = await session.scalars(select(Car.brand).where(Car.is_public.is_(True)).distinct())
    brands_by_key: dict[str, str] = {}
    for value in result.all():
        brand = " ".join(value.split())
        if brand:
            brands_by_key.setdefault(brand.casefold(), brand)
    return sorted(brands_by_key.values(), key=str.casefold)


@app.post("/api/v1/cars", response_model=CarOutput, status_code=status.HTTP_201_CREATED)
async def create_car(data: CarCreate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> CarOutput:
    validate_image_urls([data.cover_image_url, *data.image_urls])
    values = data.model_dump(exclude={"image_urls"})
    car = Car(owner_id=user.id, **values)
    image_urls = list(dict.fromkeys([data.cover_image_url, *data.image_urls]))[:5]
    car.images = [CarImage(image_url=image_url, position=index) for index, image_url in enumerate(image_urls)]
    session.add(car)
    await session.commit()
    await session.refresh(car)
    return car_output(car, user.username)


@app.post("/api/v1/uploads/images")
async def upload_image(request: Request, file: UploadFile = File(...), user: User = Depends(current_user)) -> dict[str, str]:
    del user
    stored = await image_storage.save(file)
    url = stored.location if stored.is_absolute_url else str(request.url_for("uploads", path=stored.location))
    return {"url": url}


@app.get("/api/v1/me/cars", response_model=list[OwnerCarOutput])
async def my_cars(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> list[OwnerCarOutput]:
    result = await session.scalars(select(Car).where(Car.owner_id == user.id).order_by(Car.created_at.desc()))
    return [owner_car_output(car, user.username) for car in result.all()]


@app.get("/api/v1/users/{username}/cars", response_model=list[CarOutput])
async def user_cars(username: str, session: AsyncSession = Depends(get_session)) -> list[CarOutput]:
    user = await session.scalar(select(User).where(User.username == username.lower()))
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    result = await session.scalars(select(Car).where(Car.owner_id == user.id, Car.is_public.is_(True)).order_by(Car.created_at.desc()))
    return [car_output(car, user.username) for car in result.all()]


@app.get("/api/v1/cars/{car_id}", response_model=CarOutput)
async def get_car(car_id: uuid.UUID, session: AsyncSession = Depends(get_session), user: User | None = Depends(optional_user)) -> CarOutput:
    visibility = Car.is_public.is_(True)
    if user:
        visibility = or_(visibility, Car.owner_id == user.id)
    row = (await session.execute(select(Car, User.username).join(User).where(Car.id == car_id, visibility))).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    car, username = row
    output = car_output(car, username)
    if user:
        output.is_favorite = await session.get(Favorite, (user.id, car.id)) is not None
        rating = await session.get(CarRating, (user.id, car.id))
        output.my_rating = rating.score if rating else None
    return output


@app.patch("/api/v1/cars/{car_id}", response_model=OwnerCarOutput)
async def update_car(car_id: uuid.UUID, data: CarUpdate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> OwnerCarOutput:
    car = await session.scalar(select(Car).where(Car.id == car_id))
    if car is None:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    if car.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    values = data.model_dump(exclude_unset=True)
    image_urls = values.pop("image_urls", None)
    if image_urls is not None:
        validate_image_urls(image_urls)
    if "cover_image_url" in values:
        validate_image_urls([values["cover_image_url"]])
    for field, value in values.items():
        setattr(car, field, value)
    if image_urls is not None:
        unique_urls = list(dict.fromkeys(image_urls))[:5]
        car.images = [CarImage(image_url=image_url, position=index) for index, image_url in enumerate(unique_urls)]
        if unique_urls:
            car.cover_image_url = unique_urls[0]
    await session.commit()
    await session.refresh(car)
    return owner_car_output(car, user.username)


@app.delete("/api/v1/cars/{car_id}", status_code=204)
async def delete_car(car_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> None:
    car = await session.scalar(select(Car).where(Car.id == car_id))
    if car is None:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    if car.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    await session.delete(car)
    await session.commit()


async def participant_conversation(conversation_id: uuid.UUID, user: User, session: AsyncSession) -> Conversation:
    conversation = await session.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            or_(Conversation.user_one_id == user.id, Conversation.user_two_id == user.id),
        )
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Диалог не найден")
    return conversation


async def conversation_output(conversation: Conversation, user: User, session: AsyncSession) -> ConversationOutput:
    other_id = conversation.user_two_id if conversation.user_one_id == user.id else conversation.user_one_id
    other = await session.get(User, other_id)
    if other is None:
        raise HTTPException(status_code=404, detail="Собеседник не найден")
    last = await session.scalar(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.desc()).limit(1))
    unread = int(
        await session.scalar(
            select(func.count(Message.id)).where(
                Message.conversation_id == conversation.id,
                Message.sender_id != user.id,
                Message.read_at.is_(None),
            )
        )
        or 0
    )
    return ConversationOutput(
        id=conversation.id,
        other_username=other.username,
        other_display_name=other.display_name,
        other_avatar_url=other.avatar_url,
        last_message=last.content if last else None,
        last_message_at=last.created_at if last else conversation.updated_at,
        unread_count=unread,
    )


@app.post("/api/v1/cars/{car_id}/conversation", response_model=ConversationOutput)
async def start_conversation(car_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> ConversationOutput:
    car = await session.get(Car, car_id)
    if car is None or not car.is_public:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    if car.owner_id == user.id:
        raise HTTPException(status_code=400, detail="Нельзя написать самому себе")
    first_id, second_id = sorted((user.id, car.owner_id), key=str)
    conversation = await session.scalar(select(Conversation).where(Conversation.user_one_id == first_id, Conversation.user_two_id == second_id))
    if conversation is None:
        conversation = Conversation(user_one_id=first_id, user_two_id=second_id)
        try:
            async with session.begin_nested():
                session.add(conversation)
                await session.flush()
            await session.commit()
            await session.refresh(conversation)
        except IntegrityError:
            conversation = await session.scalar(select(Conversation).where(Conversation.user_one_id == first_id, Conversation.user_two_id == second_id))
            if conversation is None:
                raise
    return await conversation_output(conversation, user, session)


@app.get("/api/v1/conversations", response_model=list[ConversationOutput])
async def conversations(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> list[ConversationOutput]:
    result = await session.scalars(select(Conversation).where(or_(Conversation.user_one_id == user.id, Conversation.user_two_id == user.id)).order_by(Conversation.updated_at.desc()))
    return [await conversation_output(conversation, user, session) for conversation in result.all()]


@app.get("/api/v1/conversations/{conversation_id}", response_model=ConversationOutput)
async def get_conversation(conversation_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> ConversationOutput:
    conversation = await participant_conversation(conversation_id, user, session)
    return await conversation_output(conversation, user, session)


@app.get("/api/v1/conversations/{conversation_id}/messages", response_model=list[MessageOutput])
async def messages(conversation_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> list[MessageOutput]:
    await participant_conversation(conversation_id, user, session)
    rows = list((await session.execute(select(Message, User.username).join(User, User.id == Message.sender_id).where(Message.conversation_id == conversation_id).order_by(Message.created_at.desc()).limit(200))).all())
    rows.reverse()
    now = datetime.now(UTC)
    output: list[MessageOutput] = []
    for message, username in rows:
        if message.sender_id != user.id and message.read_at is None:
            message.read_at = now
        output.append(
            MessageOutput(
                id=message.id,
                conversation_id=message.conversation_id,
                sender_username=username,
                content=message.content,
                created_at=message.created_at,
                read_at=message.read_at,
            )
        )
    await session.execute(update(Message).where(
        Message.conversation_id == conversation_id,
        Message.sender_id != user.id,
        Message.read_at.is_(None),
    ).values(read_at=now))
    await session.commit()
    return output


@app.post("/api/v1/conversations/{conversation_id}/messages", response_model=MessageOutput, status_code=201)
async def create_message(conversation_id: uuid.UUID, data: MessageCreate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> MessageOutput:
    conversation = await participant_conversation(conversation_id, user, session)
    content = data.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="Сообщение не может быть пустым")
    message = Message(conversation_id=conversation.id, sender_id=user.id, content=content)
    conversation.updated_at = datetime.now(UTC)
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return MessageOutput(id=message.id, conversation_id=message.conversation_id, sender_username=user.username, content=message.content, created_at=message.created_at, read_at=message.read_at)


@app.get("/api/v1/community/messages", response_model=list[CommunityMessageOutput])
async def community_messages(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> list[CommunityMessageOutput]:
    del user
    rows = list((await session.execute(select(CommunityMessage, User.username).join(User, User.id == CommunityMessage.sender_id).order_by(CommunityMessage.created_at.desc()).limit(200))).all())
    rows.reverse()
    return [CommunityMessageOutput(id=message.id, sender_username=username, content=message.content, created_at=message.created_at) for message, username in rows]


@app.post("/api/v1/community/messages", response_model=CommunityMessageOutput, status_code=201)
async def create_community_message(data: MessageCreate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> CommunityMessageOutput:
    content = data.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="Сообщение не может быть пустым")
    message = CommunityMessage(sender_id=user.id, content=content)
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return CommunityMessageOutput(id=message.id, sender_username=user.username, content=message.content, created_at=message.created_at)


def post_select():
    return (
        select(
            Post,
            User.username,
            Car.brand,
            Car.model,
            Car.cover_image_url,
            func.count(func.distinct(PostLike.user_id)).label("likes_count"),
            func.count(func.distinct(Comment.id)).label("comments_count"),
        )
        .join(User, User.id == Post.author_id)
        .join(Car, Car.id == Post.car_id)
        .where(Car.is_public.is_(True))
        .outerjoin(PostLike, PostLike.post_id == Post.id)
        .outerjoin(Comment, Comment.post_id == Post.id)
        .group_by(Post.id, User.username, Car.brand, Car.model, Car.cover_image_url)
    )


def post_output(row: Any, is_liked: bool = False) -> PostOutput:
    post, username, brand, model, cover, likes, comments = row
    return PostOutput(id=post.id, author_username=username, car_id=post.car_id, car_name=f"{brand} {model}", car_cover_url=cover, content=post.content, created_at=post.created_at, likes_count=likes, comments_count=comments, is_liked=is_liked)


@app.get("/api/v1/posts", response_model=PaginatedPosts)
async def posts(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=30), session: AsyncSession = Depends(get_session), user: User | None = Depends(optional_user)) -> PaginatedPosts:
    total = int(await session.scalar(select(func.count(Post.id)).join(Car).where(Car.is_public.is_(True))) or 0)
    rows = (await session.execute(post_select().order_by(Post.created_at.desc(), Post.id).offset((page - 1) * page_size).limit(page_size))).all()
    liked = set(await session.scalars(select(PostLike.post_id).where(PostLike.user_id == user.id, PostLike.post_id.in_([row[0].id for row in rows])))) if user and rows else set()
    return PaginatedPosts(items=[post_output(row, row[0].id in liked) for row in rows], page=page, page_size=page_size, total=total, total_pages=math.ceil(total / page_size) if total else 0)


@app.post("/api/v1/posts", response_model=PostOutput, status_code=201)
async def create_post(data: PostCreate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> PostOutput:
    car = await session.scalar(select(Car).where(Car.id == data.car_id, Car.owner_id == user.id))
    if car is None:
        raise HTTPException(status_code=403, detail="Публикацию можно создать только для своего автомобиля")
    if not car.is_public:
        raise HTTPException(status_code=422, detail="Сначала сделайте автомобиль публичным")
    post = Post(author_id=user.id, car_id=car.id, content=data.content)
    session.add(post)
    await session.commit()
    row = (await session.execute(post_select().where(Post.id == post.id))).one()
    return post_output(row)


@app.get("/api/v1/posts/{post_id}", response_model=PostOutput)
async def get_post(post_id: uuid.UUID, session: AsyncSession = Depends(get_session), user: User | None = Depends(optional_user)) -> PostOutput:
    row = (await session.execute(post_select().where(Post.id == post_id))).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Публикация не найдена")
    liked = await session.get(PostLike, (user.id, post_id)) is not None if user else False
    return post_output(row, liked)


@app.delete("/api/v1/posts/{post_id}", status_code=204)
async def delete_post(post_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> None:
    post = await session.get(Post, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Публикация не найдена")
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    await session.delete(post)
    await session.commit()


@app.put("/api/v1/posts/{post_id}/like", status_code=204)
async def like_post(post_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> None:
    if await session.scalar(select(Post).join(Car).where(Post.id == post_id, Car.is_public.is_(True)).with_for_update(of=Post)) is None:
        raise HTTPException(status_code=404, detail="Публикация не найдена")
    exists = await session.scalar(select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id))
    if exists is None:
        session.add(PostLike(post_id=post_id, user_id=user.id))
        await session.commit()


@app.delete("/api/v1/posts/{post_id}/like", status_code=204)
async def unlike_post(post_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> None:
    await session.scalar(select(Post).where(Post.id == post_id).with_for_update())
    like = await session.scalar(select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id))
    if like:
        await session.delete(like)
        await session.commit()


@app.get("/api/v1/posts/{post_id}/comments", response_model=list[CommentOutput])
async def comments(post_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> list[CommentOutput]:
    if await session.scalar(select(Post.id).join(Car).where(Post.id == post_id, Car.is_public.is_(True))) is None:
        raise HTTPException(status_code=404, detail="Публикация не найдена")
    rows = (await session.execute(select(Comment, User.username).join(User, User.id == Comment.author_id).where(Comment.post_id == post_id).order_by(Comment.created_at))).all()
    return [CommentOutput(id=comment.id, author_username=username, content=comment.content, created_at=comment.created_at) for comment, username in rows]


@app.post("/api/v1/posts/{post_id}/comments", response_model=CommentOutput, status_code=201)
async def create_comment(post_id: uuid.UUID, data: CommentCreate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> CommentOutput:
    if await session.scalar(select(Post).join(Car).where(Post.id == post_id, Car.is_public.is_(True)).with_for_update(of=Post)) is None:
        raise HTTPException(status_code=404, detail="Публикация не найдена")
    comment = Comment(post_id=post_id, author_id=user.id, content=data.content)
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return CommentOutput(id=comment.id, author_username=user.username, content=comment.content, created_at=comment.created_at)


@app.delete("/api/v1/comments/{comment_id}", status_code=204)
async def delete_comment(comment_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> None:
    comment = await session.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    if comment.author_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    await session.delete(comment)
    await session.commit()


@app.put("/api/v1/cars/{car_id}/favorite", status_code=204)
async def favorite_car(car_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> None:
    car = await session.scalar(select(Car).where(Car.id == car_id).with_for_update())
    if car is None or not car.is_public:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    exists = await session.scalar(select(Favorite).where(Favorite.car_id == car_id, Favorite.user_id == user.id))
    if exists is None:
        session.add(Favorite(car_id=car_id, user_id=user.id))
        car.favorites_count += 1
        await session.commit()


@app.delete("/api/v1/cars/{car_id}/favorite", status_code=204)
async def unfavorite_car(car_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> None:
    car = await session.scalar(select(Car).where(Car.id == car_id).with_for_update())
    favorite = await session.scalar(select(Favorite).where(Favorite.car_id == car_id, Favorite.user_id == user.id))
    if favorite:
        await session.delete(favorite)
        if car:
            car.favorites_count = max(0, car.favorites_count - 1)
        await session.commit()


@app.get("/api/v1/me/favorites", response_model=list[CarOutput])
async def favorite_cars(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> list[CarOutput]:
    rows = (await session.execute(select(Car, User.username).join(Favorite, Favorite.car_id == Car.id).join(User, User.id == Car.owner_id).where(Favorite.user_id == user.id, Car.is_public.is_(True)).order_by(Favorite.created_at.desc()))).all()
    return [car_output(car, username) for car, username in rows]


async def refresh_rating(car: Car, session: AsyncSession) -> RatingOutput:
    avg, count = (await session.execute(select(func.avg(CarRating.score), func.count(CarRating.score)).where(CarRating.car_id == car.id))).one()
    car.rating_avg = round(float(avg or 0) * 10)
    car.rating_count = int(count)
    await session.commit()
    return RatingOutput(rating_avg=float(avg or 0), rating_count=int(count))


@app.put("/api/v1/cars/{car_id}/rating", response_model=RatingOutput)
async def rate_car(car_id: uuid.UUID, data: RatingInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> RatingOutput:
    car = await session.scalar(select(Car).where(Car.id == car_id).with_for_update())
    if car is None or not car.is_public:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    if car.owner_id == user.id:
        raise HTTPException(status_code=403, detail="Нельзя оценивать собственный автомобиль")
    rating = await session.scalar(select(CarRating).where(CarRating.car_id == car_id, CarRating.user_id == user.id))
    if rating:
        rating.score = data.score
    else:
        session.add(CarRating(car_id=car_id, user_id=user.id, score=data.score))
    await session.flush()
    return await refresh_rating(car, session)


@app.delete("/api/v1/cars/{car_id}/rating", response_model=RatingOutput)
async def delete_rating(car_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> RatingOutput:
    car = await session.scalar(select(Car).where(Car.id == car_id).with_for_update())
    if car is None or (not car.is_public and car.owner_id != user.id):
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    rating = await session.scalar(select(CarRating).where(CarRating.car_id == car_id, CarRating.user_id == user.id))
    if rating:
        await session.delete(rating)
        await session.flush()
    return await refresh_rating(car, session)


async def owned_car(car_id: uuid.UUID, user: User, session: AsyncSession) -> Car:
    car = await session.get(Car, car_id)
    if car is None:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    if car.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return car


@app.get("/api/v1/cars/{car_id}/service-records", response_model=list[ServiceRecordOutput])
async def service_records(car_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> list[ServiceRecord]:
    await owned_car(car_id, user, session)
    result = await session.scalars(select(ServiceRecord).where(ServiceRecord.car_id == car_id).order_by(ServiceRecord.service_date.desc()))
    return list(result.all())


@app.post("/api/v1/cars/{car_id}/service-records", response_model=ServiceRecordOutput, status_code=201)
async def create_service_record(car_id: uuid.UUID, data: ServiceRecordInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> ServiceRecord:
    await owned_car(car_id, user, session)
    record = ServiceRecord(car_id=car_id, **data.model_dump())
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


@app.patch("/api/v1/service-records/{record_id}", response_model=ServiceRecordOutput)
async def update_service_record(record_id: uuid.UUID, data: ServiceRecordUpdate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> ServiceRecord:
    record = await session.get(ServiceRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    await owned_car(record.car_id, user, session)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    await session.commit()
    await session.refresh(record)
    return record


@app.delete("/api/v1/service-records/{record_id}", status_code=204)
async def delete_service_record(record_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)) -> None:
    record = await session.get(ServiceRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    await owned_car(record.car_id, user, session)
    await session.delete(record)
    await session.commit()


@app.get("/api/v1/cars/{car_id}/service-stats", response_model=ServiceStats)
async def service_stats(car_id: uuid.UUID, user: User = Depends(current_user), session: AsyncSession = Depends(get_session), currency: str = Query("KGS", pattern="^[A-Z]{3}$")) -> ServiceStats:
    await owned_car(car_id, user, session)
    records = list((await session.scalars(select(ServiceRecord).where(ServiceRecord.car_id == car_id, ServiceRecord.currency == currency))).all())
    by_category: dict[str, Any] = {}
    by_month: dict[str, Any] = {}
    for record in records:
        by_category[record.category] = by_category.get(record.category, 0) + record.cost
        month = record.service_date.strftime("%Y-%m")
        by_month[month] = by_month.get(month, 0) + record.cost
    return ServiceStats(total=sum((record.cost for record in records), start=Decimal(0)), currency=currency, by_category=by_category, by_month=by_month)
