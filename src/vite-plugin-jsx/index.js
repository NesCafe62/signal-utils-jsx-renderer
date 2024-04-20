import { transformSync } from '@babel/core';
import * as t from '@babel/types';
import SyntaxJSX from '@babel/plugin-syntax-jsx';

function isComponent(tagName) {
	if (tagName === '') {
		return false;
	}
	const firstChar = tagName.charAt(0);
	return firstChar === firstChar.toUpperCase();
}

const RegExpWhitespace = new RegExp("^[\\s\\t\\r\\n]*$");

function isOnlyWhiteSpace(text) {
	return (
		text.length === 0 ||
		RegExpWhitespace.test(text)
	);
}

function transformNode(node) {
	if (t.isJSXText(node)) {
		const text = node.extra.raw;
		if (isOnlyWhiteSpace(text)) {
			return null;
		}
		return t.stringLiteral(text);
	}
	if (t.isJSXExpressionContainer(node)) {
		return node.expression;
	}
	let tagName = '';
	let props = null;
	if (!t.isJSXFragment(node)) {
		const openingElement = node.openingElement;
		tagName = openingElement.name.name;
		props = [];
		let events = null;
		for (const attr of openingElement.attributes) {
			if (t.isJSXSpreadAttribute(attr)) {
				props.push(t.spreadElement(attr.argument));
			} else {
				const propName = attr.name.name;
				const value = t.isJSXExpressionContainer(attr.value)
					? attr.value.expression
					: attr.value;
				if (propName === 'ref') {
					let refCallback;
					if (t.isArrowFunctionExpression(value)) {
						refCallback = value;
					} else {
						refCallback = t.arrowFunctionExpression(
							[t.identifier('el')],
							t.assignmentExpression('=', value, t.identifier('el'))
						);
					}
					props.push(t.objectProperty(t.stringLiteral('ref'), refCallback));
					continue;
				} else if (propName.startsWith('on') && propName !== 'on') {
					if (!events) {
						events = [];
					}
					const event = propName.slice(2).toLowerCase();
					events.push(t.objectProperty(t.stringLiteral(event), value));
					continue;
				}
				props.push(t.objectProperty(t.stringLiteral(propName), value || t.nullLiteral()));
			}
		}
		if (events) {
			props.push(
				t.objectProperty(
					t.stringLiteral('on'),
					t.objectExpression(events)
				)
			);
		}
	}
	const args = [
		isComponent(tagName) ? t.identifier(tagName) : t.stringLiteral(tagName),
		props ? t.objectExpression(props) : t.nullLiteral(),
		t.arrayExpression(node.children.reduce((res, child) => {
			const node = transformNode(child);
			if (node !== null) {
				res.push(node);
			}
			return res;
		}, []))
	];
	return t.callExpression(t.identifier('h'), args);
}

function transform(path) {
	path.replaceWith(transformNode(path.node), path.node);
}

export default function jsxPlugin(options = {}) {
	const { include, exclude, babelPlugins = [], ...babelPluginOptions } = options;
	const filter = function(id) {
		return id.match(/\.[jt]sx$/);
	};
	return {
		name: 'jsx-plugin',
		async config(config) {
			// only apply esbuild to ts files, we are handling jsx and tsx
			return {
				esbuild: { include: /\.ts$/ }
			};
		},
		async transform(source, id, transformOptions) {
			const filepath = id.replace(/\?.+$/, '');
			if (!filter(id) || !filter(filepath)) {
				return null;
			}
			const plugins = [...babelPlugins];

			if (id.endsWith('.tsx') || filepath.endsWith('.tsx')) {
                // requires @babel/plugin-transform-typescript as additional dependency for ts support
				plugins.push([
					await import('@babel/plugin-transform-typescript').then(
						(r) => r.default
					),
					{ isTSX: true, allowExtensions: true },
				]);
			}
			
			plugins.push(() => {
				return {
					inherits: SyntaxJSX.default,
					visitor: {
						JSXFragment: transform,
						JSXElement: transform,
					}
				};
			});
			plugins.push('@babel/plugin-syntax-jsx');
			const options = {
				babelrc: false,
        		configFile: false,
				plugins,
				sourceMaps: true,
				sourceFileName: id,
			};
			let { code, map } = transformSync(source, options);
			code = 'import { h } from "signal-utils-jsx-renderer/renderer/dom/hyperscript";' + code;
			return { code, map };
		}
	};
}