export class View {
    constructor(tagName) {
        this.domElement = document.createElement(tagName);
        this.visible = true;
        this.cacheDisplayStyle = this.domElement.style.display;
    }

    addStyleName(className) {
        this.domElement.classList.add(className);
    }

    setStyleName(className) {
        this.domElement.classList = className;
    }

    removeStyleName(className) {
        this.domElement.classList.remove(className);
    }

    async addView(view) {
        this.domElement.appendChild(view.domElement);
    }

    async removeView(view) {
        this.domElement.removeChild(view.domElement);
    }

    hasView(view) {
        return this.domElement.contains(view.domElement);
    }

    async insertView(view, position) {
        this.domElement.insertBefore(view.domElement, this.domElement.childNodes[position - 1]);
    }

    setAttribute(name, value) {
        this.domElement.setAttribute(name, value);
    }

    getAttribute(name) {
        return this.domElement.getAttribute(name);
    }

    setId(id) {
        this.setAttribute('id', id);
    }

    getId() {
        return this.getAttribute('id');
    }

    setVisible(visible) {
        if (visible) {
            this.domElement.style.display = this.cacheDisplayStyle;
        } else {
            this.cacheDisplayStyle = this.domElement.style.display;
            this.domElement.style.display = 'none';
        }
        this.visible = visible;
    }

    clear() {
        this.domElement.innerHTML = '';
    }
}