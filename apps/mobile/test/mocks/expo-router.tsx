import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export interface RouterState {
  pathname: string;
  history: string[];
}

export interface RouterController {
  pathname: string;
  history: string[];
  push(path: string): void;
  replace(path: string): void;
  back(): void;
}

const RouterContext = createContext<RouterController | null>(null);

export function RouterProvider({
  initialPath = "/",
  children
}: PropsWithChildren<{ initialPath?: string }>) {
  const [state, setState] = useState<RouterState>({
    pathname: initialPath,
    history: [initialPath]
  });

  const controller = useMemo<RouterController>(
    () => ({
      pathname: state.pathname,
      history: state.history,
      push(path) {
        setState((current) => ({
          ...(current.pathname === path
            ? current
            : {
                pathname: path,
                history: [...current.history, path]
              })
        }));
      },
      replace(path) {
        setState((current) => ({
          ...(current.pathname === path
            ? current
            : {
                pathname: path,
                history:
                  current.history.length === 0
                    ? [path]
                    : [...current.history.slice(0, -1), path]
              })
        }));
      },
      back() {
        setState((current) => {
          if (current.history.length <= 1) {
            return current;
          }

          const history = current.history.slice(0, -1);

          return {
            pathname: history[history.length - 1] ?? "/",
            history
          };
        });
      }
    }),
    [state.history, state.pathname]
  );

  return <RouterContext.Provider value={controller}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterController {
  const router = useContext(RouterContext);

  if (router === null) {
    return {
      pathname: "/",
      history: ["/"],
      push() {},
      replace() {},
      back() {}
    };
  }

  return router;
}

export function usePathname() {
  return useRouter().pathname;
}

export function Redirect({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return <div>{`redirect:${href}`}</div>;
}

export function Slot({ children }: PropsWithChildren) {
  return <>{children ?? null}</>;
}

function NavigationContainer({
  kind,
  children
}: PropsWithChildren<{ kind: "drawer" | "stack" | "tabs" }>) {
  return <div data-testid={`${kind}-navigation`}>{children}</div>;
}

function NavigationScreen({ children }: PropsWithChildren<{ name: string }>) {
  return <>{children ?? null}</>;
}

export const Tabs = Object.assign(
  function Tabs({ children }: PropsWithChildren) {
    return <NavigationContainer kind="tabs">{children}</NavigationContainer>;
  },
  { Screen: NavigationScreen }
);

export const Stack = Object.assign(
  function Stack({ children }: PropsWithChildren) {
    return <NavigationContainer kind="stack">{children}</NavigationContainer>;
  },
  { Screen: NavigationScreen }
);
