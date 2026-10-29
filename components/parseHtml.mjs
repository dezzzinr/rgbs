import parse from "html-react-parser";
import { createElement, isValidElement } from "react";

// HTML attribute names are case-insensitive, but React DOM props are not.
// Some html-react-parser versions preserve the HTML spelling of fetchpriority.
// Normalize the parsed React element, rather than editing the HTML source (the
// HTML parser may lowercase source attributes again).
export default function parseHtml(html) {
  return parse(html, {
    transform(node) {
      if (
        !isValidElement(node) ||
        !Object.prototype.hasOwnProperty.call(node.props, "fetchpriority")
      ) {
        return node;
      }
      const { fetchpriority, ...props } = node.props;
      return createElement(node.type, {
        ...props,
        key: node.key,
        fetchPriority: props.fetchPriority ?? fetchpriority,
      });
    },
  });
}
