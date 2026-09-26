import type { RouteObject } from "react-router";
import RootProviders from "./RootProviders";
import RootRedirect from "./RootRedirect";
import AuthGuard from "./AuthGuard";
import HomePage from "../pages/app/HomePage";
import ProfilePage from "../pages/app/ProfilePage";
import ContractsListPage from "../pages/app/ContractsListPage";
import ContractCreatePage from "../pages/app/ContractCreatePage";
import ContractDetailPage from "../pages/app/ContractDetailPage";
import OnboardingPage from "../pages/app/OnboardingPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import NotFoundPage from "../pages/NotFoundPage";
import AppLayout from "../pages/app/AppLayout";

export const appRoutes: RouteObject[] = [
  {
    // Providers that need the router context (e.g. useNavigate) live inside it.
    element: <RootProviders />,
    children: [
      {
        path: "/",
        element: <RootRedirect />,
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
      {
        path: "/app",
        element: <AuthGuard />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: "profile", element: <ProfilePage /> },
              {
                path: "contracts",
                children: [
                  { index: true, element: <ContractsListPage /> },
                  { path: "new", element: <ContractCreatePage /> },
                  { path: ":id", element: <ContractDetailPage /> },
                ],
              },
              { path: "onboarding", element: <OnboardingPage /> },
            ],
          },
        ],
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
];
