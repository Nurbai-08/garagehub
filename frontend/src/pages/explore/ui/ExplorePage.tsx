import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CarCard,
  getCarBrands,
  getCars,
  type CarFilters,
} from "@/entities/car";

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState<{ value: string; from: string } | null>(null);
  const search = draft?.from === params.toString() ? draft.value : params.get("search") ?? "";
  const page = validNumber(params.get("page"), 1) ?? 1;
  const filters: CarFilters = {
    search: params.get("search") || undefined,
    brand: params.get("brand") || undefined,
    year_from: validNumber(params.get("year_from"), 1886),
    power_from: validNumber(params.get("power_from"), 0),
    drivetrain: params.get("drivetrain") || undefined,
    sort: ["newest", "rating", "popular"].includes(params.get("sort") ?? "")
      ? params.get("sort") as CarFilters["sort"] : "newest",
    page,
  };

  useEffect(() => {
    if (!draft || draft.from !== params.toString()) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search.trim()) next.set("search", search.trim());
      else next.delete("search");
      next.delete("page");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
      setDraft(null);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, search, params, setParams]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (key !== "page") next.delete("page");
    if (search.trim()) next.set("search", search.trim());
    else next.delete("search");
    setDraft(null);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const { data: brands = [] } = useQuery({
    queryKey: ["car-brands"],
    queryFn: getCarBrands,
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cars", filters],
    queryFn: () => getCars(filters),
  });
  const cars = data?.items ?? [];

  return (
    <main id="main-content" className="inner-page">
      <p className="kicker">Общий гараж</p>
      <h1>Машины друзей</h1>
      <div className="searchbar">
        <Search size={19} />
        <input
          value={search}
          onChange={(event) => setDraft({ value: event.target.value, from: params.toString() })}
          aria-label="Поиск автомобилей"
          placeholder="Марка, модель или пользователь"
        />
      </div>
      <div className="catalog-filters">
        <select
          value={params.get("brand") ?? ""}
          onChange={(event) => updateFilter("brand", event.target.value)}
        >
          <option value="">Все марки</option>
          {brands.map((brand) => (
            <option value={brand} key={brand}>
              {brand}
            </option>
          ))}
        </select>
        <select
          value={params.get("drivetrain") ?? ""}
          onChange={(event) => updateFilter("drivetrain", event.target.value)}
        >
          <option value="">Любой привод</option>
          <option value="FWD">Передний</option>
          <option value="RWD">Задний</option>
          <option value="AWD">Полный</option>
        </select>
        <input
          type="number"
          min="1886"
          placeholder="Год от"
          value={params.get("year_from") ?? ""}
          onChange={(event) => updateFilter("year_from", event.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder="Мощность от"
          value={params.get("power_from") ?? ""}
          onChange={(event) => updateFilter("power_from", event.target.value)}
        />
        <select
          value={params.get("sort") ?? "newest"}
          onChange={(event) => updateFilter("sort", event.target.value)}
        >
          <option value="newest">Сначала новые</option>
          <option value="rating">По рейтингу</option>
          <option value="popular">По популярности</option>
        </select>
        {params.size > 0 && (
          <button
            onClick={() => {
              setDraft(null);
              setParams({});
            }}
          >
            <X size={15} /> Очистить
          </button>
        )}
      </div>
      {isError && (
        <div className="error">
          Не удалось загрузить автомобили.{" "}
          <button onClick={() => refetch()}>Повторить</button>
        </div>
      )}
      {isLoading ? (
        <div className="catalog">
          {[1, 2, 3].map((n) => (
            <div className="skeleton" key={n} />
          ))}
        </div>
      ) : isError ? null : cars.length ? (
        <div className="catalog">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Search />
          <h2>Ничего не найдено</h2>
          <p>Попробуйте изменить запрос.</p>
        </div>
      )}
      {data && data.total_pages > 1 && (
        <nav className="pagination" aria-label="Страницы каталога">
          <button disabled={page === 1} onClick={() => updateFilter("page", String(page - 1))}>Назад</button>
          <span>{page} / {data.total_pages}</span>
          <button disabled={page >= data.total_pages} onClick={() => updateFilter("page", String(page + 1))}>Далее</button>
        </nav>
      )}
    </main>
  );
}

function validNumber(value: string | null, minimum: number) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum ? number : undefined;
}
