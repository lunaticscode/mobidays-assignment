import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";

import { QueryProvider } from "@/providers/QueryProvider";
import { router } from "@/routes";

function App() {
  return (
    <QueryProvider>
      <RouterProvider router={router} />
      <Toaster />
    </QueryProvider>
  );
}

export default App;
