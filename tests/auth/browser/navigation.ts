export function useRouter() {
  return { push() {}, replace() {}, refresh() {} };
}

export function usePathname() { return window.location.pathname; }
