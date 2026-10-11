import type { ComponentProps } from "react";
import { AuthApp } from "./AuthApp";
import { httpAuthGateway } from "./httpGateway";

export default function ProductionAuthApp(props: Omit<ComponentProps<typeof AuthApp>, "gateway">) {
  return <AuthApp {...props} gateway={httpAuthGateway} />;
}
