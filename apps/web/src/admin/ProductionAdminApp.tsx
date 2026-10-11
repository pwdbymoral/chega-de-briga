import type { ComponentProps } from "react";
import AdminApp from "./AdminApp";
import { httpAdminGateway } from "./httpGateway";

export default function ProductionAdminApp(props: Omit<ComponentProps<typeof AdminApp>, "gateway">) {
  return <AdminApp {...props} gateway={httpAdminGateway} />;
}
