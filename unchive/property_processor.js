// Property Processor Worker
// This worker processes component properties in a separate thread

this.addEventListener('message', function (e) {
    const propertyJSON = e.data.propertyJSON;
    const descriptorJSON = e.data.descriptorJSON;
    const properties = [];

    for (let descriptor of descriptorJSON) {
        if (propertyJSON.hasOwnProperty(descriptor.name)) {
            properties.push({
                name: descriptor.name,
                value: propertyJSON[descriptor.name]
            });
        } else {
            properties.push({
                name: descriptor.name,
                value: descriptor.defaultValue,
                editorType: descriptor.editorType
            });
        }
    }

    this.postMessage({ properties: properties });
}, false);