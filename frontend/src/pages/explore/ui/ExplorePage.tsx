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
  const [search, setSearch] = useState(params.get("search") ?? "");
  const filters: CarFilters = {
    search: params.get("search") || undefined,
    brand: params.get("brand") || undefined,
    year_from: params.get("year_from")
      ? Number(params.get("year_from"))
      : undefined,
    power_from: params.get("power_from")
      ? Number(params.get("power_from"))
      : undefined,
    drivetrain: params.get("drivetrain") || undefined,
    sort: (params.get("sort") as CarFilters["sort"]) || "newest",
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search.trim()) next.set("search", search.trim());
      else next.delete("search");
      if (next.toString() !== params.toString())
        setParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, params, setParams]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const { data: brands = [] } = useQuery({
    queryKey: ["car-brands"],
    queryFn: getCarBrands,
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cars", params.toString()],
    queryFn: () => getCars(filters),
  });
  const cars = data?.items ?? [];

  return (
    <main className="inner-page">
      <p className="kicker">Общий гараж</p>
      <h1>Машины друзей</h1>
      <div className="searchbar">
        <Search size={19} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
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
              setSearch("");
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
      ) : cars.length ? (
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
    </main>
  );
}
