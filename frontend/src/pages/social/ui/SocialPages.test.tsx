import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getPosts, unlikePost, likePost } from "@/entities/post";
import { FeedPage } from "./SocialPages";

vi.mock("@/features/auth", () => ({ useAuth: () => ({ user: { username: "other" } }) }));
vi.mock("@/entities/car", () => ({ getMyCars: vi.fn().mockResolvedValue([]) }));
vi.mock("@/entities/post", () => ({
  getPosts: vi.fn(),
  getPost: vi.fn(),
  createPost: vi.fn(),
  deleteComment: vi.fn(),
  getComments: vi.fn(),
  createComment: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));

const post = { id: "post", author_username: "owner", car_id: "car", car_name: "BMW M3", car_cover_url: "/photo.jpg", content: "Story", created_at: "2026-09-05T10:00:00Z", likes_count: 3, comments_count: 0, is_liked: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPosts).mockResolvedValue({ items: [post], page: 1, page_size: 10, total: 11, total_pages: 2 });
});
afterEach(cleanup);

function open() {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><FeedPage /></MemoryRouter></QueryClientProvider>);
}

it("restores an existing like and sends unlike when clicked", async () => {
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Убрать лайк" }));
  await waitFor(() => expect(unlikePost).toHaveBeenCalledWith("post"));
  expect(likePost).not.toHaveBeenCalled();
});

it("loads the next page of publications", async () => {
  open();
  fireEvent.click(await screen.findByText("Далее"));
  await waitFor(() => expect(getPosts).toHaveBeenLastCalledWith(2));
});
