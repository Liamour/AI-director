// Tiny JSON-Schema-shaped validator. Just enough surface for our 3 starting agents.
// Keep it deliberately small — if we outgrow it, swap in Zod in a single file.

import type { SchemaNode } from './types';

export interface ValidateResult<T> {
  ok: boolean;
  value?: T;
  issues?: string[];
}

export function validate<T>(node: SchemaNode, value: unknown, path = '$'): ValidateResult<T> {
  const issues: string[] = [];
  walk(node, value, path, issues);
  if (issues.length === 0) return { ok: true, value: value as T };
  return { ok: false, issues };
}

function walk(node: SchemaNode, value: unknown, path: string, out: string[]): void {
  switch (node.type) {
    case 'string': {
      if (typeof value !== 'string') {
        out.push(`${path} expected string, got ${typeOf(value)}`);
        return;
      }
      if (node.minLength !== undefined && value.length < node.minLength) {
        out.push(`${path} string too short (min ${node.minLength}, got ${value.length})`);
      }
      if (node.enum && !node.enum.includes(value)) {
        out.push(`${path} must be one of [${node.enum.join('|')}], got "${value}"`);
      }
      return;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        out.push(`${path} expected number, got ${typeOf(value)}`);
      }
      return;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        out.push(`${path} expected boolean, got ${typeOf(value)}`);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        out.push(`${path} expected array, got ${typeOf(value)}`);
        return;
      }
      if (node.minItems !== undefined && value.length < node.minItems) {
        out.push(`${path} array too short (min ${node.minItems}, got ${value.length})`);
      }
      value.forEach((v, i) => walk(node.items, v, `${path}[${i}]`, out));
      return;
    }
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        out.push(`${path} expected object, got ${typeOf(value)}`);
        return;
      }
      const obj = value as Record<string, unknown>;
      const required = node.required ?? [];
      for (const key of required) {
        if (!(key in obj)) {
          out.push(`${path}.${key} is required but missing`);
        }
      }
      for (const [key, child] of Object.entries(node.properties)) {
        if (key in obj) {
          walk(child, obj[key], `${path}.${key}`, out);
        }
      }
      return;
    }
  }
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * Render a schema as a TypeScript-ish interface fragment.
 * Used to inject schema info into LLM system prompts so the model knows the shape.
 */
export function schemaToTs(node: SchemaNode, indent = 0): string {
  const pad = '  '.repeat(indent);
  switch (node.type) {
    case 'string':
      return node.enum ? node.enum.map((e) => `'${e}'`).join(' | ') : 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${schemaToTs(node.items, indent)}[]`;
    case 'object': {
      const lines = Object.entries(node.properties).map(([k, v]) => {
        const required = (node.required ?? []).includes(k);
        return `${pad}  ${k}${required ? '' : '?'}: ${schemaToTs(v, indent + 1)};`;
      });
      return `{\n${lines.join('\n')}\n${pad}}`;
    }
  }
}
