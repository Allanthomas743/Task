document.addEventListener('DOMContentLoaded', function() {
    const xmlTree = document.getElementById('xml-tree');
    const elementList = document.getElementById('element-list');
    const jsonOutput = document.getElementById('json-output');
    const uploadXml = document.getElementById('upload-xml');
    const uploadXmlB = document.getElementById('upload-xml-b');
    const downloadJsonButton = document.getElementById('download-json');
    const saveMappingsButton = document.getElementById('save-mappings');
    const loadMappingsButton = document.getElementById('load-mappings');
    const addElementButton = document.getElementById('add-element');
    const newElementInput = document.getElementById('new-element');
    const attributeModal = document.getElementById('attribute-modal');
    const attributeForm = document.getElementById('attribute-form');
    const submitAttributeButton = document.getElementById('submit-attribute');
    const closeButton = document.querySelector('.close-button');

    let outputElements = [];
    let attributesArray = []; // Global array to store attributes
    let draggedElement = '';
    let targetElement = '';
    let jsonObject = {}; // Initialize jsonObject

    renderElementList(outputElements);

    uploadXml.addEventListener('change', handleFileUploadA);
    uploadXmlB.addEventListener('change', handleFileUploadB);
    downloadJsonButton.addEventListener('click', downloadJson);
    saveMappingsButton.addEventListener('click', saveMappings);
    loadMappingsButton.addEventListener('click', loadMappings);
    addElementButton.addEventListener('click', addElementToList);

    document.addEventListener('keydown', function(event) {
        if (event.key === 'x' || event.key === 'X') {
            xPressed = true;
        }
    });

    document.addEventListener('keyup', function(event) {
        if (event.key === 'x' || event.key === 'X') {
            xPressed = false;
        }
    });

    function handleFileUploadA(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const xmlString = e.target.result;
                const formattedXml = formatXml(xmlString);
                renderXmlTree(formattedXml);
            };
            reader.readAsText(file);
        }
    }

    function handleFileUploadB(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const xmlString = e.target.result;
                const xmlDoc = new DOMParser().parseFromString(xmlString, 'text/xml');
                const elements = new Set(); // Use a Set to avoid duplicates
                extractElements(xmlDoc.documentElement, elements);
                outputElements = Array.from(elements); // Convert Set to Array
                renderElementList(outputElements);
            };
            reader.readAsText(file);
        }
    }
    
    function extractElements(node, elements) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            elements.add(node.tagName);
        }
        node.childNodes.forEach(child => extractElements(child, elements));
    }

    function formatXml(xml) {
        const PADDING = ' '.repeat(2); // 2 spaces
        const reg = /(>)(<)(\/*)/g;
        let pad = 0;
        xml = xml.replace(reg, '$1\r\n$2$3');
        return xml.split('\r\n').map((node, index) => {
            let indent = 0;
            if (node.match(/.+<\/\w[^>]*>$/)) {
                indent = 0;
            } else if (node.match(/^<\/\w/)) {
                if (pad != 0) {
                    pad -= 1;
                }
            } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                indent = 1;
            } else {
                indent = 0;
            }
            pad += indent;
            return PADDING.repeat(pad - indent) + node;
        }).join('\r\n');
    }

    function renderXmlTree(xmlString) {
        xmlTree.textContent = xmlString;
        Prism.highlightElement(xmlTree);
    }

    function renderElementList(elements) {
        elementList.innerHTML = '';
        elements.forEach(el => {
            const li = document.createElement('li');
            li.textContent = el;
            li.setAttribute('draggable', true);
            li.addEventListener('dragstart', handleDragStart);
            elementList.appendChild(li);
        });
    }

    function handleDragStart(event) {
        event.dataTransfer.setData("text/plain", event.target.textContent);
    }

    xmlTree.addEventListener('dragover', handleDragOver);
    xmlTree.addEventListener('drop', handleDrop);

    function handleDragOver(event) {
        event.preventDefault();
    }

    function handleDrop(event) {
        event.preventDefault();
        const data = event.dataTransfer.getData("text/plain");
        const target = event.target;

        if (target.tagName === 'SPAN' && target.className.includes('token tag')) {
            draggedElement = data;
            const targetText = target.textContent;
            targetElement = targetText.replace('<', '').replace('>', '').split(' ')[0];

            const parent = target.parentNode;
            const siblings = Array.from(parent.childNodes);
            console.log(parent.nextSibling)

            attributesArray = []; // Reset attributes
            let xpath = `//${targetElement}`;
            for (let i = 0; i < siblings.length; i++){
                let attribNode = siblings[i];
                if (attribNode.className == 'token attr-name') {
                    const attribName = attribNode.textContent;
                    for (i + 1; i < siblings.length; i++){
                        let valueNode = siblings[i];
                        if (valueNode.className == 'token attr-value') {
                            const attribValue = valueNode.textContent.replace(/="(.*?)"/, '$1');
                            attributesArray.push({ name: attribName, value: attribValue });
                            break;
                        }
                    }
                }
            }
            showAttributeSelection();
        }
    }

    function showAttributeSelection() {
        if (attributesArray.length === 0) {
            updateJsonOutput(draggedElement, `//${targetElement}`); // No attributes to select
            return;
        }

        // Clear previous form content
        attributeForm.innerHTML = '';

        // Create radio buttons for attributes
        attributesArray.forEach(attr => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'attribute';
            radio.value = `${attr.name}='${attr.value}'`;
            label.appendChild(radio);
            label.appendChild(document.createTextNode(` ${attr.name}='${attr.value}'`));
            attributeForm.appendChild(label);
            attributeForm.appendChild(document.createElement('br'));
        });

        // Show the modal
        attributeModal.style.display = 'block';
    }

    function closeModal() {
        attributeModal.style.display = 'none';
    }

    submitAttributeButton.addEventListener('click', function() {
        const selectedRadio = document.querySelector('input[name="attribute"]:checked');
        if (selectedRadio) {
            const selectedAttr = selectedRadio.value;
            const [name, value] = selectedAttr.split("='");
            const xpath = `//${targetElement}[@${name}='${value.replace(/'$/, '')}']`;
            updateJsonOutput(draggedElement, xpath);
            closeModal(); // Close modal after selection
        }
    });

    closeButton.addEventListener('click', closeModal);

    function updateJsonOutput(elementName, xpath) {
        // Initialize or update the JSON object
        const newElementObject = {
            "xpath": xpath
        };

        // Create a new object with the element name as the key
        const newJsonObject = {
            [elementName]: newElementObject
        };

        // Merge the new object into the existing JSON object
        jsonObject = { ...jsonObject, ...newJsonObject };

        // Convert the updated JSON object to a formatted string
        const json = JSON.stringify(jsonObject, null, 2);

        // Update the output element with the new JSON string
        jsonOutput.textContent = json;

        console.log(jsonOutput.textContent);
    }

    function downloadJson() {
        const blob = new Blob([jsonOutput.textContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function saveMappings() {
        // Implement save logic here
    }

    function loadMappings() {
        // Implement load logic here
    }

    function addElementToList() {
        const newElement = newElementInput.value.trim();
        if (newElement) {
            if (!outputElements.includes(newElement)) {
                outputElements.push(newElement);
                renderElementList(outputElements);
                newElementInput.value = '';
            } else {
                alert('Element already exists.');
            }
        }
    }
});
