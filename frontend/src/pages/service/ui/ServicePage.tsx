import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Gauge,
  MapPin,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMyCars } from "@/entities/car";
import {
  createServiceRecord,
  deleteServiceRecord,
  getServiceRecords,
  getServiceStats,
  type ServiceRecordInput,
} from "@/entities/service-record";
import { apiMessage } from "@/shared/api";

const categories: Record<string, string> = {
  maintenance: "Плановое ТО",
  repair: "Ремонт",
  consumables: "Расходники",
  tuning: "Тюнинг",
  insurance: "Страховка",
  care: "Мойка и уход",
  other: "Другое",
};
const emptyForm: ServiceRecordInput = {
  category: "maintenance",
  title: "",
  description: null,
  service_date: new Date().toISOString().slice(0, 10),
  mileage: null,
  cost: 0,
  currency: "KGS",
  location: null,
  is_public: false,
};

export function ServicePage() {
  const { carId = "" } = useParams();
  const queryClient = useQueryClient();
  const { data: cars = [] } = useQuery({
    queryKey: ["my-cars"],
    queryFn: getMyCars,
  });
  const car = cars.find((item) => item.id === carId);
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["service-records", carId],
    queryFn: () => getServiceRecords(carId),
  });
  const { data: stats } = useQuery({
    queryKey: ["service-stats", carId],
    queryFn: () => getServiceStats(carId),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ServiceRecordInput>(emptyForm);
  const [error, setError] = useState("");
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["service-records", carId] }),
      queryClient.invalidateQueries({ queryKey: ["service-stats", carId] }),
    ]);
  };
  const create = useMutation({
    mutationFn: (input: ServiceRecordInput) =>
      createServiceRecord(carId, input),
    onSuccess: async () => {
      setOpen(false);
      setForm(emptyForm);
      await refresh();
    },
    onError: (value) => setError(apiMessage(value)),
  });
  const remove = useMutation({
    mutationFn: deleteServiceRecord,
    onSuccess: refresh,
  });
  const maxCategory = useMemo(
    () => Math.max(1, ...Object.values(stats?.by_category ?? {}).map(Number)),
    [stats],
  );
  const update = <K extends keyof ServiceRecordInput>(
    key: K,
    value: ServiceRecordInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setError("");
    if (!form.title.trim() || !form.service_date || form.cost < 0) {
      setError("Заполните название, дату и корректную стоимость");
      return;
    }
    create.mutate({
      ...form,
      title: form.title.trim(),
      description: form.description || null,
      location: form.location || null,
    });
  };

  return (
    <main className="service-page">
      <section className="service-hero">
        <Link to="/garage" className="back">
          <ArrowLeft /> Мой гараж
        </Link>
        <div>
          <p className="kicker">История обслуживания</p>
          <h1>{car ? `${car.brand} ${car.model}` : "Автомобиль"}</h1>
          <p>Каждая работа, расход и деталь — в хронологии владения.</p>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          <Plus /> Добавить запись
        </button>
      </section>
      <section className="service-content">
        <div className="stats-row">
          <div>
            <Receipt />
            <small>Всего расходов</small>
            <b>
              {Number(stats?.total ?? 0).toLocaleString("ru-RU")}{" "}
              <em>{stats?.currency ?? "KGS"}</em>
            </b>
          </div>
          <div>
            <Wrench />
            <small>Записей</small>
            <b>{records.length}</b>
          </div>
          <div>
            <TrendingUp />
            <small>Последняя работа</small>
            <b>
              {records[0]
                ? new Date(records[0].service_date).toLocaleDateString("ru-RU")
                : "—"}
            </b>
          </div>
        </div>
        <div className="service-layout">
          <section className="timeline">
            <div className="service-section-head">
              <p className="kicker">Хронология</p>
              <h2>История работ</h2>
            </div>
            {isLoading ? (
              <div className="page-loader">Загружаем историю…</div>
            ) : records.length ? (
              records.map((record) => (
                <article key={record.id}>
                  <time>
                    {new Date(record.service_date).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                  <span />
                  <div>
                    <small>
                      {categories[record.category] ?? record.category}
                    </small>
                    <h3>{record.title}</h3>
                    {record.description && <p>{record.description}</p>}
                    <div className="service-record-meta">
                      <span>
                        <Gauge />{" "}
                        {record.mileage?.toLocaleString("ru-RU") ?? "—"} км
                      </span>
                      {record.location && (
                        <span>
                          <MapPin /> {record.location}
                        </span>
                      )}
                      <b>
                        {Number(record.cost).toLocaleString("ru-RU")}{" "}
                        {record.currency}
                      </b>
                      <button onClick={() => remove.mutate(record.id)}>
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty">
                <Wrench />
                <h2>История пока пуста</h2>
                <p>Добавьте первую запись об обслуживании.</p>
              </div>
            )}
          </section>
          <aside className="expense-chart">
            <p className="kicker">Расходы</p>
            <h2>По категориям</h2>
            {Object.entries(stats?.by_category ?? {}).map(
              ([category, amount]) => (
                <div className="bar" key={category}>
                  <span>{categories[category] ?? category}</span>
                  <b>{Number(amount).toLocaleString("ru-RU")}</b>
                  <i
                    style={{
                      width: `${(Number(amount) / maxCategory) * 100}%`,
                    }}
                  />
                </div>
              ),
            )}
            {!Object.keys(stats?.by_category ?? {}).length && (
              <p className="muted">Данные появятся после первой записи.</p>
            )}
          </aside>
        </div>
      </section>
      {open && (
        <div className="record-modal" role="dialog" aria-modal="true">
          <button className="modal-close" onClick={() => setOpen(false)}>
            <X />
          </button>
          <div>
            <p className="kicker">Новая запись</p>
            <h2>Что было сделано?</h2>
            <div className="form-grid">
              <label className="field">
                <span>Категория</span>
                <select
                  value={form.category}
                  onChange={(event) => update("category", event.target.value)}
                >
                  {Object.entries(categories).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Дата</span>
                <input
                  type="date"
                  value={form.service_date}
                  onChange={(event) =>
                    update("service_date", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Название *</span>
                <input
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="Замена масла и фильтров"
                />
              </label>
              <label className="field">
                <span>Пробег, км</span>
                <input
                  type="number"
                  value={form.mileage ?? ""}
                  onChange={(event) =>
                    update(
                      "mileage",
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Стоимость *</span>
                <input
                  type="number"
                  value={form.cost}
                  onChange={(event) =>
                    update("cost", Number(event.target.value))
                  }
                />
              </label>
              <label className="field">
                <span>Валюта</span>
                <select
                  value={form.currency}
                  onChange={(event) => update("currency", event.target.value)}
                >
                  <option>KGS</option>
                  <option>RUB</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </label>
              <label className="field full">
                <span>Сервис / место</span>
                <input
                  value={form.location ?? ""}
                  onChange={(event) => update("location", event.target.value)}
                  placeholder="Название сервиса"
                />
              </label>
              <label className="field full">
                <span>Описание</span>
                <textarea
                  rows={4}
                  value={form.description ?? ""}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  placeholder="Запчасти, детали работы, рекомендации…"
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(event) => update("is_public", event.target.checked)}
              />
              <span>✓</span>Показывать эту запись публично
            </label>
            {error && <div className="form-error">{error}</div>}
            <button
              className="primary"
              disabled={create.isPending}
              onClick={submit}
            >
              {create.isPending ? "Сохраняем…" : "Сохранить запись"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
