import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/features/auth";
import { apiMessage } from "@/shared/api";

const loginSchema = z.object({
  email: z.email("Введите корректный email"),
  password: z.string().min(8, "Минимум 8 символов"),
});

const registerSchema = loginSchema
  .extend({
    username: z
      .string()
      .min(3, "Минимум 3 символа")
      .max(30)
      .regex(/^[A-Za-z0-9_]+$/, "Только латинские буквы, цифры и _"),
    confirmPassword: z.string(),
    accepted: z.literal(true, { error: "Нужно принять правила" }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают",
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const schema = mode === "login" ? loginSchema : registerSchema;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues | RegisterValues>({ resolver: zodResolver(schema) });

  const requested = (location.state as { from?: string } | null)?.from;
  const from = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/garage";
  if (auth.user) return <Navigate to={from} replace />;
  const submit = async (values: LoginValues | RegisterValues) => {
    setServerError("");
    try {
      if (mode === "login")
        await auth.login({ email: values.email, password: values.password });
      else {
        const registration = values as RegisterValues;
        await auth.register({
          email: registration.email,
          username: registration.username,
          password: registration.password,
        });
      }
      navigate(from, { replace: true });
    } catch (error) {
      setServerError(apiMessage(error));
    }
  };

  return (
    <main id="main-content" className="auth-page">
      <section className="auth-visual">
        <div>
          <p className="kicker">Гараж для своих</p>
          <blockquote>
            «За каждой машиной всё равно стоит какая-то своя история»
          </blockquote>
          <span>Заходи, собирай любимые модели и делись ими с друзьями.</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="kicker">
            {mode === "login" ? "С возвращением" : "Твоя подборка начинается здесь"}
          </p>
          <h1>{mode === "login" ? "Войти" : "Создать аккаунт"}</h1>
          <p className="auth-lead">
            {mode === "login"
              ? "Продолжите историю своего автомобиля."
              : "Присоединяйся к сообществу любителей машин."}
          </p>
          <form onSubmit={handleSubmit(submit)} noValidate>
            {mode === "register" && (
              <Field
                label="Username"
                error={
                  "username" in errors ? errors.username?.message : undefined
                }
              >
                <input
                  autoComplete="username"
                  placeholder="northdrive"
                  {...register("username" as keyof RegisterValues)}
                />
              </Field>
            )}
            <Field label="Email" error={errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register("email")}
              />
            </Field>
            <Field label="Пароль" error={errors.password?.message}>
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="Не менее 8 символов"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Показать пароль"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </Field>
            {mode === "register" && (
              <>
                <Field
                  label="Повторите пароль"
                  error={
                    "confirmPassword" in errors
                      ? errors.confirmPassword?.message
                      : undefined
                  }
                >
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...register("confirmPassword" as keyof RegisterValues)}
                  />
                </Field>
                <label className="check">
                  <input
                    type="checkbox"
                    {...register("accepted" as keyof RegisterValues)}
                  />
                  <span>
                    <Check size={13} />
                  </span>
                  Я принимаю правила сообщества и политику конфиденциальности
                </label>
                {"accepted" in errors && (
                  <p className="field-error">{errors.accepted?.message}</p>
                )}
              </>
            )}
            {serverError && (
              <div className="form-error" role="alert">
                {serverError}
              </div>
            )}
            <button className="primary submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Подождите…"
                : mode === "login"
                  ? "Войти в Гараж"
                  : "Создать аккаунт"}{" "}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "Ещё нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <Link to={mode === "login" ? "/register" : "/login"} state={{ from }}>
              {mode === "login" ? "Зарегистрироваться" : "Войти"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
