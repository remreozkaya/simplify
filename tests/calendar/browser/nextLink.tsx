import React from "react";

// The fixture mounts the planner outside Next's router.
export default function Link(props: React.ComponentProps<"a">) {
  return <a {...props} />;
}
