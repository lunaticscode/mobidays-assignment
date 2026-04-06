import { createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import RootLayout from "@/shared/layout/RootLayout";

const DashboardPage = lazy(() => import("./dashboard/DashboardPage"));

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <DashboardPage />,
      },
    ],
  },
]);
