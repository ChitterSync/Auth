import dynamic from "next/dynamic";
import React from "react";
import { FontAwesomeIconProps } from "@fortawesome/react-fontawesome";

// Dynamically import FontAwesomeIcon from the CJS build with SSR disabled
const NoSSRFontAwesomeIcon = dynamic<FontAwesomeIconProps>(
  () =>
    import("@fortawesome/react-fontawesome").then((mod: typeof import("@fortawesome/react-fontawesome")) => {
      const Comp = mod.FontAwesomeIcon;
      if (!Comp) throw new Error("FontAwesomeIcon named export not found in CJS build");
      const WrappedFontAwesomeIcon = (props: FontAwesomeIconProps) => <Comp {...props} />;
      WrappedFontAwesomeIcon.displayName = "NoSSRFontAwesomeIcon";
      return WrappedFontAwesomeIcon;
    }),
  { ssr: false }
);

export default function FontAwesomeNoSSR(props: FontAwesomeIconProps) {
  return <NoSSRFontAwesomeIcon {...props} />;
}
