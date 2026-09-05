import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "@/features/auth";
import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";
import { HomePage } from "@/pages/home";
import { ExplorePage } from "@/pages/explore";
import { NotFoundPage } from "@/pages/not-found";

const AuthPage = lazy(() =>
  import("@/pages/auth").then((module) => ({ default: module.AuthPage })),
);
const GaragePage = lazy(() =>
  import("@/pages/garage").then((module) => ({ default: module.GaragePage })),
);
const CarFormPage = lazy(() =>
  import("@/pages/garage").then((module) => ({ default: module.CarFormPage })),
);
const CarDetailPage = lazy(() =>
  import("@/pages/garage").then((module) => ({
    default: module.CarDetailPage,
  })),
);
const FeedPage = lazy(() =>
  import("@/pages/social").then((module) => ({ default: module.FeedPage })),
);
const PostDetailPage = lazy(() =>
  import("@/pages/social").then((module) => ({
    default: module.PostDetailPage,
  })),
);
const FavoritesPage = lazy(() =>
  import("@/pages/social").then((module) => ({
    default: module.FavoritesPage,
  })),
);
const PublicProfilePage = lazy(() =>
  import("@/pages/profile").then((module) => ({
    default: module.PublicProfilePage,
  })),
);
const ProfileSettingsPage = lazy(() =>
  import("@/pages/profile").then((module) => ({
    default: module.ProfileSettingsPage,
  })),
);
const MessagesPage = lazy(() =>
  import("@/pages/messages").then((module) => ({
    default: module.MessagesPage,
  })),
);
const CommunityChatPage = lazy(() =>
  import("@/pages/messages").then((module) => ({
    default: module.CommunityChatPage,
  })),
);

const ServicePage = lazy(() =>
  import("@/pages/service").then((module) => ({ default: module.ServicePage })),
);

const protectedPage = (page: React.ReactNode) => (
  <RequireAuth>{page}</RequireAuth>
);

export default function App() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main id="main-content" className="inner-page">
            <div className="page-loader">Загружаем страницу…</div>
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/posts/:postId" element={<PostDetailPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/garage" element={protectedPage(<GaragePage />)} />
          <Route
            path="/garage/new"
            element={protectedPage(<CarFormPage mode="create" />)}
          />
          <Route
            path="/garage/:carId/edit"
            element={protectedPage(<CarFormPage mode="edit" />)}
          />
          <Route path="/garage/:carId/service" element={protectedPage(<ServicePage />)} />
          <Route path="/favorites" element={protectedPage(<FavoritesPage />)} />
          <Route path="/messages" element={protectedPage(<MessagesPage />)} />
          <Route
            path="/messages/community"
            element={protectedPage(<CommunityChatPage />)}
          />
          <Route
            path="/messages/:conversationId"
            element={protectedPage(<MessagesPage />)}
          />
          <Route path="/cars/:carId" element={<CarDetailPage />} />
          <Route path="/users/:username" element={<PublicProfilePage />} />
          <Route
            path="/settings/profile"
            element={protectedPage(<ProfileSettingsPage />)}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Footer />
    </>
  );
}
