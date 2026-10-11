import type { ComponentProps } from "react";
import { AuthApp } from "./AuthApp";
import { demoAuthGateway } from "../admin/mockGateway";

export default function DemoAuthApp(props: Omit<ComponentProps<typeof AuthApp>, "gateway">) {
  return <AuthApp {...props} gateway={demoAuthGateway} />;
}
