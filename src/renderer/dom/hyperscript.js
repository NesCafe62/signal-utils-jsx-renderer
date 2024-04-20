import { effect } from 'signal-utils/subtle/microtask-effect';

export function render(app, el, props = undefined) {
	const appEl = app(props);
	el.replaceWith(appEl);
	return appEl;
}

export function h(type, props = null, children = null) {
	if (typeof type === 'function') {
		const componentProps = children
			? {children: children, ...props}
			: props;
		return type(componentProps);
	}
	const el = (type === '')
		? document.createDocumentFragment()
		: document.createElement(type);
	for (let prop in props) {
		const value = props[prop];
	        if (prop === 'on') {
	            for (let eventType in value) {
	                el.addEventListener(eventType, value[eventType]);
	            }
	            continue;
	        }
		if (prop === 'ref') {
			value(el);
			continue;
		}
		if (prop === 'show') {
			bindShow(el, value);
			continue;
		}
		if (
			prop === 'style' &&
			typeof value === 'object' &&
			value !== null
		) {
			bindStyle(el, value);
			continue;
		}
		if (prop === 'classList') {
			bindClassList(el, value);
			continue;
		}
		if (value === undefined) {
			continue;
		}
		if (prop === 'innerHTML') {
			(typeof value === 'function')
				? bindAttrDirect(el, prop, value)
				: el.innerHTML = value;
			continue;
		}
		(typeof value === 'function')
			? bindAttr(el, prop, value)
			: el.setAttribute(prop, value);
	}
	if (children) {
		const length = children.length;
		for (let i = 0; i < length; i++) {
			let child = children[i];
			if (typeof child === 'function') {
				const getter = child;
				child = document.createTextNode('');
				bindText(child, getter);
			} else if (typeof child !== 'object') {
				if (typeof child !== 'string') {
					child = child.toString();
				}
				child = document.createTextNode(child);
			}
			el.appendChild(child);
		}
	}
	return el;
}

export function fragment(els) {
	return h('', null, els);
}

export function template(render) {
	let el;
	return function() {
		return (el || (el = render())).cloneNode(true);
	}
}

export function bindText(el, getter) {
	effect(() => {
		el.nodeValue = getter();
	});
}

export function bindAttr(el, attrName, getter) {
	effect(() => {
		const value = getter();
		if (value === undefined) {
			el.removeAttribute(attrName);
		} else {
			el.setAttribute(attrName, value);
		}
	});
}

export function bindAttrDirect(el, attrName, getter) {
	effect(() => {
		el[attrName] = getter();
	});
}

export function bindClassList(el, classList) {
	for (const className in classList) {
		const hasClass = classList[className];
		const applyClass = function(hasClass) {
			if (hasClass) {
				el.classList.add(className);
			} else {
				el.classList.remove(className);
			}
		};
		(typeof hasClass === 'function')
			? effect(() => applyClass(hasClass()))
			: applyClass(hasClass);
	}
}

export function bindShow(el, getter) {
	const applyStyle = function(isShow) {
		el.style.display = isShow ? '' : 'none';
	};
	(typeof getter === 'function')
		? effect(() => applyStyle(getter()))
		: applyStyle(getter);
}

export function bindStyle(el, styles) {
	for (const propName in styles) {
		const value = styles[propName];
		const applyStyle = propName.startsWith('--')
			? function(value) {
				el.style.setProperty(propName, value);
			}
			: function(value) {
				el.style[propName] = value;
			};
		(typeof value === 'function')
			? effect(() => applyStyle(value()))
			: applyStyle(value);
	}
}