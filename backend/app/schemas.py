import re
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterInput(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9_]+", value):
            raise ValueError("Допустимы латинские буквы, цифры и _")
        return value.lower()


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    username: str
    display_name: str | None
    avatar_url: str | None


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=100)


class PublicProfile(BaseModel):
    username: str
    display_name: str | None
    bio: str | None
    city: str | None
    avatar_url: str | None
    created_at: datetime
    cars_count: int
    posts_count: int


class TokenOutput(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOutput


class CarCreate(BaseModel):
    brand: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=80)
    year: int = Field(ge=1886, le=datetime.now().year + 1)
    mileage: int = Field(default=0, ge=0)
    power_hp: int | None = Field(default=None, ge=0, le=5000)
    drivetrain: str | None = Field(default=None, max_length=24)
    generation: str | None = Field(default=None, max_length=80)
    trim: str | None = Field(default=None, max_length=100)
    vin: str | None = Field(default=None, min_length=11, max_length=32)
    cover_image_url: str = Field(min_length=1, max_length=500)
    image_urls: list[str] = Field(min_length=3, max_length=5)
    description: str | None = Field(default=None, max_length=5000)
    is_public: bool = True


class CarUpdate(BaseModel):
    brand: str | None = Field(default=None, min_length=1, max_length=80)
    model: str | None = Field(default=None, min_length=1, max_length=80)
    year: int | None = Field(default=None, ge=1886, le=datetime.now().year + 1)
    mileage: int | None = Field(default=None, ge=0)
    power_hp: int | None = Field(default=None, ge=0, le=5000)
    drivetrain: str | None = Field(default=None, max_length=24)
    generation: str | None = Field(default=None, max_length=80)
    trim: str | None = Field(default=None, max_length=100)
    vin: str | None = Field(default=None, min_length=11, max_length=32)
    cover_image_url: str | None = Field(default=None, min_length=1, max_length=500)
    image_urls: list[str] | None = Field(default=None, min_length=3, max_length=5)
    description: str | None = Field(default=None, max_length=5000)
    is_public: bool | None = None


class CarOutput(BaseModel):
    id: uuid.UUID
    brand: str
    model: str
    year: int
    power_hp: int | None
    drivetrain: str | None
    mileage: int
    cover_image_url: str
    image_urls: list[str]
    description: str | None
    generation: str | None
    trim: str | None
    is_public: bool
    owner_username: str
    rating_avg: float
    rating_count: int
    favorites_count: int


class OwnerCarOutput(CarOutput):
    vin: str | None


class PaginatedCars(BaseModel):
    items: list[CarOutput]
    page: int
    page_size: int
    total: int
    total_pages: int


class PostCreate(BaseModel):
    car_id: uuid.UUID
    content: str = Field(min_length=1, max_length=2000)


class PostOutput(BaseModel):
    id: uuid.UUID
    author_username: str
    car_id: uuid.UUID
    car_name: str
    car_cover_url: str
    content: str
    created_at: datetime
    likes_count: int
    comments_count: int


class PaginatedPosts(BaseModel):
    items: list[PostOutput]
    page: int
    page_size: int
    total: int
    total_pages: int


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class CommentOutput(BaseModel):
    id: uuid.UUID
    author_username: str
    content: str
    created_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class MessageOutput(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_username: str
    content: str
    created_at: datetime
    read_at: datetime | None


class CommunityMessageOutput(BaseModel):
    id: uuid.UUID
    sender_username: str
    content: str
    created_at: datetime


class ConversationOutput(BaseModel):
    id: uuid.UUID
    other_username: str
    other_display_name: str | None
    other_avatar_url: str | None
    last_message: str | None
    last_message_at: datetime
    unread_count: int


class RatingInput(BaseModel):
    score: int = Field(ge=1, le=10)


class RatingOutput(BaseModel):
    rating_avg: float
    rating_count: int


class ServiceRecordInput(BaseModel):
    category: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=3000)
    service_date: date
    mileage: int | None = Field(default=None, ge=0)
    cost: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="KGS", min_length=3, max_length=3)
    location: str | None = Field(default=None, max_length=160)
    is_public: bool = False


class ServiceRecordOutput(ServiceRecordInput):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    car_id: uuid.UUID
    created_at: datetime


class ServiceRecordUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=1, max_length=32)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=3000)
    service_date: date | None = None
    mileage: int | None = Field(default=None, ge=0)
    cost: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    location: str | None = Field(default=None, max_length=160)
    is_public: bool | None = None


class ServiceStats(BaseModel):
    total: Decimal
    currency: str
    by_category: dict[str, Decimal]
    by_month: dict[str, Decimal]
