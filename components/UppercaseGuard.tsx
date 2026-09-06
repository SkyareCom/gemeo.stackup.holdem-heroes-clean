"use client";

import { useEffect } from "react";

const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

function uppercaseTextNode(node: Node) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName)) return;
  const value = node.nodeValue;
  if (!value) return;
  const upper = value.toLocaleUpperCase("pt-BR");
  if (upper !== value) node.nodeValue = upper;
}

function lockElement(element: Element) {
  if (element instanceof HTMLElement) {
    element.style.setProperty("text-transform", "uppercase", "important");
  }

  for (const attribute of ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value) {
      const upper = value.toLocaleUpperCase("pt-BR");
      if (upper !== value) element.setAttribute(attribute, upper);
    }
  }

  if (element.shadowRoot) uppercaseTree(element.shadowRoot);
}

function uppercaseTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    uppercaseTextNode(root);
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    uppercaseTextNode(node);
    node = walker.nextNode();
  }

  if (root instanceof Element) lockElement(root);
  if (root instanceof Element || root instanceof DocumentFragment || root instanceof Document) {
    root.querySelectorAll("*").forEach(lockElement);
  }
}

export default function UppercaseGuard() {
  useEffect(() => {
    uppercaseTree(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          uppercaseTextNode(mutation.target);
          continue;
        }
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          lockElement(mutation.target);
          continue;
        }
        for (const addedNode of mutation.addedNodes) uppercaseTree(addedNode);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });

    const enforce = window.setInterval(() => uppercaseTree(document.body), 500);

    return () => {
      observer.disconnect();
      window.clearInterval(enforce);
    };
  }, []);

  return null;
}
