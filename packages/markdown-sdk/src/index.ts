import { marked } from "marked";

export type MarkdownComponentRenderer<TProps = Record<string, unknown>> = (props: TProps) => string;

export interface MarkdownComponentRegistry {
  [componentName: string]: MarkdownComponentRenderer<Record<string, unknown>>;
}

export interface MarkdownRenderOptions {
  components?: MarkdownComponentRegistry;
}

const COMPONENT_BLOCK_REGEX = /::component\s+(\w+)\s*({[\s\S]*?})\s*::/g;

export const createMarkdownRenderer = (options: MarkdownRenderOptions = {}) => {
  const components = options.components ?? {};

  const renderCustomComponents = (raw: string) =>
    raw.replace(COMPONENT_BLOCK_REGEX, (_, componentName: string, propsJSON: string) => {
      const renderer = components[componentName];
      if (!renderer) {
        return `<div data-component-missing="${componentName}">未知组件: ${componentName}</div>`;
      }
      try {
        const props = JSON.parse(propsJSON);
        return renderer(props);
      } catch {
        return `<div data-component-error="${componentName}">组件参数解析失败</div>`;
      }
    });

  return {
    render(markdown: string) {
      const withComponents = renderCustomComponents(markdown);
      return marked.parse(withComponents, { async: false });
    }
  };
};

export const weatherCardRenderer: MarkdownComponentRenderer<{
  city: string;
  weather: string;
  temperature: string;
}> = ((props: Record<string, unknown>) => {
  const city = String(props.city ?? "");
  const weather = String(props.weather ?? "");
  const temperature = String(props.temperature ?? "");
  return `<section data-kind="weather-card"><h3>${city}</h3><p>${weather}</p><strong>${temperature}</strong></section>`;
}) as MarkdownComponentRenderer<{ city: string; weather: string; temperature: string }>;
