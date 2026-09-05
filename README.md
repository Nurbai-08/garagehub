# Гараж

«Гараж» — небольшая социальная сеть для друзей, которые собирают подборки любимых машин. Владеть автомобилем необязательно: можно добавить модель мечты, до пяти фотографий, рассказать, чем она нравится, и обсудить её с друзьями.

## Что реализовано

- адаптивная главная страница, общая лента и каталог машин;
- профиль машины с переключаемой фотогалереей;
- загрузка 3–5 JPG/PNG/WebP до 4 MB на один автомобиль;
- марки в фильтре каталога появляются автоматически из добавленных машин;
- регистрация, вход, refresh/logout и профиль пользователя;
- личная подборка, редактирование и удаление добавленных машин;
- публикации, лайки, комментарии, избранное и рейтинг;
- личные диалоги и общий чат для всех участников;
- React 19, TypeScript, Vite, TanStack Query и Framer Motion;
- FastAPI, async SQLAlchemy, PostgreSQL и Alembic;
- Vercel Blob для production-фото и локальное хранилище для разработки.

## Быстрый запуск через Docker

```bash
cp .env.example .env
docker compose up --build
```

В другом терминале можно добавить демонстрационные данные:

```bash
docker compose exec backend python -m app.seed
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- OpenAPI: http://localhost:8000/docs

Демо-аккаунт после seed: `demo@example.com` / `GarageHub123!`.

## Запуск без Docker

Требуются Node.js 22+, Python 3.12+ и PostgreSQL 16+.

```bash
cp .env.example .env
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

В отдельном терминале:

```bash
cd frontend
npm install
npm run dev
```

## Проверки

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run test

cd ../backend
ruff check app tests
pytest
```

## Архитектура

```text
garagehub/
├── frontend/          # React UI и API-клиент
├── backend/
│   ├── app/           # FastAPI, модели, схемы и security
│   ├── alembic/       # миграции PostgreSQL
│   └── tests/
├── docker-compose.yml
├── .env.example
└── README.md
```

Перед production-запуском замените `JWT_SECRET`, пароль PostgreSQL и настройте разрешённые CORS origins. Для Vercel нужны внешний PostgreSQL в `DATABASE_URL` и публичный Blob store с `BLOB_READ_WRITE_TOKEN`; подробнее в [DEPLOYMENT.md](DEPLOYMENT.md).
