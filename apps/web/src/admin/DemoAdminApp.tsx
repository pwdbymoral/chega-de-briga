import type { ComponentProps } from "react";
import AdminApp from "./AdminApp";
import { demoGateway } from "./mockGateway";

export default function DemoAdminApp(props: Omit<ComponentProps<typeof AdminApp>, "gateway">) {
  return <AdminApp {...props} gateway={demoGateway} />;
}
