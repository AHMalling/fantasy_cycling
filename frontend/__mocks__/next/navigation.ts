export const useRouter = jest.fn(() => ({
  refresh: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
}));

export const usePathname = jest.fn(() => "/");
export const useSearchParams = jest.fn(() => new URLSearchParams());
