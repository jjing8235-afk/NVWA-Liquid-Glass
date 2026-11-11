// Position fixed overlays without dirtying layout on each pointer frame.
// Individual translation preserves the existing press/drag scale and Web spring.
export function positionFixed(el, x, y) {
    const style = el.style;
    if ('translate' in style) {
        if (style.left !== '0px') style.left = '0px';
        if (style.top !== '0px') style.top = '0px';
        const value = `${x}px ${y}px`;
        if (style.translate !== value) style.translate = value;
    } else {
        // Older embedded browsers keep the existing coordinate path.
        const left = `${x}px`, top = `${y}px`;
        if (style.left !== left) style.left = left;
        if (style.top !== top) style.top = top;
    }
}
