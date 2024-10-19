import * as THREE from './modules/three.module.js';
import { OrbitControls } from './modules/OrbitControls.js';
import { FontLoader } from './modules/FontLoader.js';
import { TextGeometry } from './modules/TextGeometry.js';

class DBSchemaVisualizer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.tables = [];
        this.links = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.setupClickHandler();

        this.init();
        this.setupMouseInteraction();  // Add this line
    }

    init() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 15;
        this.scene.background = new THREE.Color(0xf0f0f0);

        window.addEventListener('resize', () => this.onWindowResize(), false);

        this.animate();
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    getColumnY(table_size, column_index) {
        return table_size * 0.25 - column_index * 0.5 - 0.6;
    }
    getTableHeight(table_size) {
        return table_size * 0.5 + 0.8;
    }
    createTableObject(table, position) {
        const tableFrameColor = 0x9CAEB0; // Darker color
        const headerBackgroundColor = 0x2980B9; // Light blue for the header background
        const rowBackgroundColor = 0xECF0F1;
        const rowBackgroundColor2 = 0xBDC3C7;
        const headerFontColor = 0xFFFFFF;
        const rowNameFontColor = 0x24394E;
        const rowTypeFontColor = 0x5F6C6D;

        const group = new THREE.Group();
        const geometry = new THREE.BoxGeometry(5, this.getTableHeight(table.columns.length) - 0.1, 0.05);
        const material = new THREE.MeshPhongMaterial({ color: tableFrameColor });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);

        const textMaterial = new THREE.MeshBasicMaterial({ color: headerFontColor });
        const headerGeometry = new THREE.PlaneGeometry(4.9, 0.6);
        const headerMaterial = new THREE.MeshBasicMaterial({ color: headerBackgroundColor });
        const headerMesh = new THREE.Mesh(headerGeometry, headerMaterial);
        headerMesh.position.set(0, this.getTableHeight(table.columns.length) / 2 - 0.45, 0.1);
        group.add(headerMesh);
    
        const fontLoader = new FontLoader();

        fontLoader.load('./modules/helvetiker_regular.typeface.json', (font) => {
            const textGeometry = new TextGeometry(table.name, {
                font: font,
                size: 0.3,
                depth: 0.01,
            });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.set(-2.4, this.getTableHeight(table.columns.length) / 2 - 0.6, 0.1);
            group.add(textMesh);

            table.columns.forEach((column, index) => {
                const rowColor = index % 2 === 0 ? rowBackgroundColor : rowBackgroundColor2;
                const rowGeometry = new THREE.PlaneGeometry(4.9, 0.5);
                const rowMaterial = new THREE.MeshBasicMaterial({ color: rowColor });
                const rowMesh = new THREE.Mesh(rowGeometry, rowMaterial);
                rowMesh.position.set(0, this.getColumnY(table.columns.length, index), 0.1);
                
                // Set userData for the row mesh
                rowMesh.userData = { table: table.name, column: column.name };
                
                group.add(rowMesh);

                // Create name text
                const nameGeometry = new TextGeometry(column.name, {
                    font: font,
                    size: 0.2,
                    depth: 0.001,
                });
                const nameMesh = new THREE.Mesh(nameGeometry, new THREE.MeshBasicMaterial({ color: rowNameFontColor }));
                nameMesh.position.set(-2.4, this.getColumnY(table.columns.length, index), 0.1);
                group.add(nameMesh);

                // Create type text
                // if column.not_null is true, add a star to the type text
                // and make the type font bold
                const typeText = column.not_null ? column.type + "*" : column.type;
                const typeGeometry = new TextGeometry(typeText, {
                    font: font,
                    size: 0.20,
                    depth: 0.001,
                });
                const typeMesh = new THREE.Mesh(typeGeometry, new THREE.MeshBasicMaterial({ color: rowTypeFontColor }));
                
                const typeBox = new THREE.Box3().setFromObject(typeMesh);
                const typeWidth = typeBox.max.x - typeBox.min.x;
                typeMesh.position.set(2.4 - typeWidth, this.getColumnY(table.columns.length, index), 0.1);
                
                group.add(typeMesh);
            });
        });

        group.position.copy(position);
        this.scene.add(group);
        this.tables.push({ name: table.name, table: table, object: group });
    }

    createLinks(schema) {
        const connectionCurveColor = 0x3498DB;
        const ballAtConnectionPointColor = 0xE74C3C;

        schema.tables.forEach(table => {
            table.foreign_keys.forEach(fk => {
                const foreignTable = this.tables.find(t => t.name === table.name);
                const primaryTable = this.tables.find(t => t.name === fk.ref_table);
                // adjust the link start and end location.. 
                // To link the foreign key K in table A to primary key Q in table B, draw a link from the right side of 
                // row K in table A to the left side of row Q in table B.
                if (foreignTable && primaryTable) {
                    const foreignPosition = new THREE.Vector3();
                    const primaryPosition = new THREE.Vector3();
                    foreignTable.object.getWorldPosition(foreignPosition);
                    primaryTable.object.getWorldPosition(primaryPosition);

                    // Adjust the positions to the correct row within the table
                    // console.log("foreignTable", foreignTable, foreignTable.columns);
                    // console.log(fk.column);
                    const foreignRow = foreignTable.table.columns.find(column => column.name === fk.column);
                    const primaryRow = primaryTable.table.columns.find(column => column.name === fk.ref_column);

                    // Adjust positions to be on the edge of the tables
                    // To link the foreign key K in table A to primary key Q in table B, draw a link from the right side of 
                    // row K in table A to the left side of row Q in table B.

                    const tableWidth = foreignTable.object.children[0].geometry.parameters.width;
                    const foreignIndex = foreignTable.table.columns.indexOf(foreignRow);
                    foreignPosition.y += this.getColumnY(foreignTable.table.columns.length, foreignIndex) + 0.1;
                    foreignPosition.x += tableWidth / 2;  // Move to the right side of the table (half the table's width)
        
                    // Calculate position on the left side of primary row (table B)
                    const primaryIndex = primaryTable.table.columns.indexOf(primaryRow);
                    primaryPosition.y += this.getColumnY(primaryTable.table.columns.length, primaryIndex) + 0.1;
                    primaryPosition.x -= tableWidth / 2;  // Move to the left side of the table (half the table's width)
        
                    // Create curved path
                    const midX = (foreignPosition.x + primaryPosition.x) / 2;
                    const curveHeight = Math.abs(foreignPosition.y - primaryPosition.y) / 2;
                    var f2 = foreignPosition.clone();
                    f2.x += 0.3;
                    var p2 = primaryPosition.clone();
                    p2.x -= 0.3;
                    const cpoints = [
                        foreignPosition,
                        f2,
                        new THREE.Vector3(foreignPosition.x + 2, foreignPosition.y, foreignPosition.z - 0.3),
                        new THREE.Vector3(primaryPosition.x - 2, primaryPosition.y, foreignPosition.z - 0.3),
                        p2,
                        primaryPosition
                    ];
                    const curve = new THREE.CatmullRomCurve3(cpoints);
                    //  const curve = new THREE.CubicBezierCurve3(
                    //      foreignPosition,
                    //      new THREE.Vector3(foreignPosition.x + 2, foreignPosition.y, foreignPosition.z + 5),
                    //      new THREE.Vector3(primaryPosition.x - 2, primaryPosition.y, primaryPosition.z + 5),
                    //      primaryPosition
                    //  );
        
                    const points = curve.getPoints(50);
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    
                    const material = new THREE.LineDashedMaterial({
                        color: connectionCurveColor,
                        linewidth: 1,
                        scale: 1,
                        dashSize: 0.3,
                        gapSize: 0.1,
                    });
                    
                    const line = new THREE.Line(geometry, material);
                    line.computeLineDistances(); // This is necessary for dashed lines
        
                    // Create small ball at the end of the line
                    const ballGeometry = new THREE.SphereGeometry(0.1, 32, 32);
                    const ballMaterial = new THREE.MeshBasicMaterial({ color: ballAtConnectionPointColor });
                    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
                    ball.position.copy(primaryPosition);
                    ball.position.x -= 0.1;
                    ball.position.z += 0.1;
                    
                    // Group line and ball
                    const group = new THREE.Group();
                    group.add(line);
                    group.add(ball);

                    // Add userData to the group for highlighting
                    group.userData = {
                        fromTable: table.name,
                        toTable: fk.ref_table,
                        fromColumn: fk.column,
                        toColumn: fk.ref_column
                    };

                    this.scene.add(group);
                    this.links.push(group);

                }
            });
        });
    }
    convertSQLtoJSON(sql) {
        const tables = [];
        let indexCounter = 1;
    
        // Remove line breaks, tabs, and carriage returns
        // replace \n with space as well    
        const cleanedSQL = sql.replace(/[\r\n\t]/g, ' ').replace(/\\n/g, ' ');
    
        // Split by "CREATE TABLE"
        const createTableStatements = cleanedSQL.split(/CREATE TABLE/i).filter(Boolean);
    
        createTableStatements.forEach(statement => {
            // Extract table name and columns
            const tableNameMatch = statement.match(/^\s*(\w+)\s*\((.*)\);?/);
            if (!tableNameMatch) return;
            const tableName = tableNameMatch[1].trim();
            const columnsDefinition = tableNameMatch[2];
    
            // Create a table object
            const table = {
                name: tableName,
                columns: [],
                primary_keys: [],
                foreign_keys: []
            };
    
            // Split columns and constraints by comma, but ignore commas within parentheses
            const columnLines = columnsDefinition.split(/,(?![^()]*\))/).map(line => line.trim());
    
            columnLines.forEach(line => {
                // Extract column definitions
                const columnMatch = line.match(/^\s*(\w+)\s+(\w+)(\((\d+)\))?\s*(NOT NULL)?/i);
                if (columnMatch) {
                    const columnName = columnMatch[1];
                    const dataType = columnMatch[2] + (columnMatch[4] ? `(${columnMatch[4]})` : '');
                    const notNull = !!columnMatch[5];
                    // do a case insensitive comparison
                    if (columnName.toLowerCase() === "primary" || columnName.toLowerCase()  === "foreign") {
                        // skip this column
                    } else {
                        table.columns.push({
                            name: columnName,
                            type: dataType,
                            is_primary: false,
                            not_null: notNull,
                            index: indexCounter++
                        });
                    }
                }
    
                // Detect PRIMARY KEY definitions
                const primaryKeyMatch = line.match(/PRIMARY KEY\s*\((.+)\)/i);
                if (primaryKeyMatch) {
                    const primaryKeyColumns = primaryKeyMatch[1].split(',').map(col => col.trim());
                    table.primary_keys.push(...primaryKeyColumns);
                    primaryKeyColumns.forEach(pk => {
                        const column = table.columns.find(col => col.name === pk);
                        if (column) {
                            column.is_primary = true;
                        }
                        console.log("primaryKeyColumn", column);
                    });
                }
    
                // Detect FOREIGN KEY definitions
                const foreignKeyMatch = line.match(/FOREIGN KEY\s*\((.+)\)\s*REFERENCES\s*(\w+)\s*\((.+)\)/i);
                if (foreignKeyMatch) {
                    const foreignKeyColumn = foreignKeyMatch[1].trim();
                    const referencedTable = foreignKeyMatch[2].trim();
                    const referencedColumn = foreignKeyMatch[3].trim();
                    console.log("foreignKeyColumn", foreignKeyColumn, referencedTable, referencedColumn);
                    table.foreign_keys.push({
                        column: foreignKeyColumn,
                        ref_table: referencedTable,
                        ref_column: referencedColumn
                    });
                }
            });
    
            tables.push(table);
        });
    
        return { tables };
    }
    
    convertSQLtoJSONbackup(sql) {
        const tables = [];
        let indexCounter = 1;
    
        // Remove line breaks, tabs, and carriage returns
        // replace \n with space as well    
        const cleanedSQL = sql.replace(/[\r\n\t]/g, ' ').replace(/\\n/g, ' ');
    
        // Split by "CREATE TABLE"
        const createTableStatements = cleanedSQL.split(/CREATE TABLE/i).filter(Boolean);
    
        createTableStatements.forEach(statement => {
            // Extract table name and columns
            const tableNameMatch = statement.match(/^\s*(\w+)\s*\((.*)\);?/);
            if (!tableNameMatch) return;
            const tableName = tableNameMatch[1].trim();
            const columnsDefinition = tableNameMatch[2];
    
            // Create a table object
            const table = {
                name: tableName,
                columns: [],
                primary_keys: [],
                foreign_keys: []
            };
    
            // Split columns and constraints by comma, but ignore commas within parentheses
            const columnLines = columnsDefinition.split(/,(?![^()]*\))/).map(line => line.trim());
    
            columnLines.forEach(line => {
                // Extract column definitions
                const columnMatch = line.match(/^\s*(\w+)\s+(\w+)(\((\d+)\))?/);
                if (columnMatch) {
                    const columnName = columnMatch[1];
                    const dataType = columnMatch[2] + (columnMatch[4] ? `(${columnMatch[4]})` : '');
                    // do a case insensitive comparison
                    if (columnName.toLowerCase() === "primary" || columnName.toLowerCase()  === "foreign") {
                        // skip this column
                    } else {
                        table.columns.push({
                            name: columnName,
                            type: dataType,
                            is_primary: false,
                            index: indexCounter++
                        });
                    }
                }
    
                // Detect PRIMARY KEY definitions
                const primaryKeyMatch = line.match(/PRIMARY KEY\s*\((.+)\)/i);
                if (primaryKeyMatch) {
                    const primaryKeyColumns = primaryKeyMatch[1].split(',').map(col => col.trim());
                    table.primary_keys.push(...primaryKeyColumns);
                    primaryKeyColumns.forEach(pk => {
                        const column = table.columns.find(col => col.name === pk);
                        if (column) {
                            column.is_primary = true;
                        }
                        console.log("primaryKeyColumn", column);
                    });
                }
    
                // Detect FOREIGN KEY definitions
                const foreignKeyMatch = line.match(/FOREIGN KEY\s*\((.+)\)\s*REFERENCES\s*(\w+)\s*\((.+)\)/i);
                if (foreignKeyMatch) {
                    const foreignKeyColumn = foreignKeyMatch[1].trim();
                    const referencedTable = foreignKeyMatch[2].trim();
                    const referencedColumn = foreignKeyMatch[3].trim();
                    console.log("foreignKeyColumn", foreignKeyColumn, referencedTable, referencedColumn);
                    table.foreign_keys.push({
                        column: foreignKeyColumn,
                        ref_table: referencedTable,
                        ref_column: referencedColumn
                    });
                }
            });
    
            tables.push(table);
        });
    
        return { tables };
    }
    
    
    visualizeSchema(schema) {
        // Clear existing objects
        this.tables.forEach(table => this.scene.remove(table.object));
        this.links.forEach(link => this.scene.remove(link));
        this.tables = [];
        this.links = [];

        const tableCount = schema.tables.length;
        const radius = 10;
        // if there are 2 tables, change the order of the tables to make sure the first table has the primary key
        if (tableCount === 2) {
            const secondTable = schema.tables.find(t => t.foreign_keys.length > 0);
            const firstTable = schema.tables.find(t => t.foreign_keys.length === 0);
            schema.tables = [firstTable, secondTable];
        }
        schema.tables.forEach((table, index) => {
            const angle = (index / tableCount) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            this.createTableObject(table, new THREE.Vector3(x, y, 0));
        });

        this.createLinks(schema);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);

        this.schema = schema; // Store the schema for later use in highlighting
    }


    setupClickHandler() {
        this.renderer.domElement.addEventListener('click', (event) => {
            event.preventDefault();
            const rect = this.renderer.domElement.getBoundingClientRect();
            
            // Convert the click position to normalized device coordinates (NDC)
            this.mouse.x = ((event.clientX - rect.left) / this.renderer.domElement.clientWidth) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / this.renderer.domElement.clientHeight) * 2 + 1;

            // Update raycaster
            this.raycaster.setFromCamera(this.mouse, this.camera);

            // Find intersected objects
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);
            
            if (intersects.length > 0) {
                let clickedObject = intersects[0].object;
                
                // Traverse up to find the group if the clicked object is a child
                while (clickedObject.parent && !this.tables.find(table => table.object.id === clickedObject.id)) {
                    clickedObject = clickedObject.parent;
                }

                const clickedTable = this.tables.find(table => table.object.id === clickedObject.id);

                if (clickedTable) {
                    this.focusOnTable(clickedTable);
                }
            }
        });
    }


    focusOnTable(table) {
        const targetPosition = new THREE.Vector3();
        table.object.getWorldPosition(targetPosition);

        // Animate camera to zoom out, then zoom in to focus on the table
        const initialZoomOutPosition = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z + 4
        };

        gsap.to(this.controls.target, {
            duration: 1.6,
            ease: "power3.inOut",
            x: targetPosition.x,
            y: targetPosition.y,
            z: targetPosition.z,
            onUpdate: () => {
                this.controls.update();
            },
        });       
        gsap.to(this.camera.position, {
            duration: 0.6,
            ease: "power3.inOut",
            x: initialZoomOutPosition.x,
            y: initialZoomOutPosition.y,
            z: initialZoomOutPosition.z,
            onUpdate: () => {
                this.camera.lookAt(targetPosition);
            },
            onComplete: () => {
                gsap.to(this.camera.position, {
                    duration: 1,
                    ease: "power3.inOut",
                    x: targetPosition.x,
                    y: targetPosition.y,
                    z: targetPosition.z + 10,
                    onUpdate: () => {
                        this.camera.lookAt(targetPosition);
                    }
                });
            }
        });
    }

    highlightConnections(hoveredRow) {
        const { table, column } = hoveredRow.userData;
    
        // Reset all highlights first
        this.resetHighlights();
    
        // Highlight connected rows and links
        this.schema.tables.forEach(schemaTable => {
            if (schemaTable.name === table) {
                schemaTable.foreign_keys.forEach(fk => {
                    if (fk.column === column) {
                        this.highlightLink(table, fk.ref_table, column, fk.ref_column);
                        this.highlightTableRow(fk.ref_table, fk.ref_column);
                    }
                });
            }
            schemaTable.foreign_keys.forEach(fk => {
                if (fk.ref_table === table && fk.ref_column === column) {
                    this.highlightLink(schemaTable.name, table, fk.column, column);
                    this.highlightTableRow(schemaTable.name, fk.column);
                }
            });
        });
    
        // Highlight the hovered row
        this.highlightTableRow(table, column);
    }
    
    highlightLink(fromTable, toTable, fromColumn, toColumn) {
        this.links.forEach(link => {
            if (
                (link.userData.fromTable === fromTable && link.userData.toTable === toTable &&
                 link.userData.fromColumn === fromColumn && link.userData.toColumn === toColumn) ||
                (link.userData.fromTable === toTable && link.userData.toTable === fromTable &&
                 link.userData.fromColumn === toColumn && link.userData.toColumn === fromColumn)
            ) {
                const linkMaterial = link.children[0].material;
                linkMaterial.color.setHex(0xff0000); // Highlight color
                linkMaterial.opacity = 1; // Make highlighted links fully opaque
                link.userData.highlighted = true; // Mark as highlighted
            }
        });
    }
    
    highlightTableRow(tableName, columnName) {
        const table = this.tables.find(t => t.name === tableName);
        if (table) {
            table.object.children.forEach(child => {
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry) {
                    if (child.userData.column === columnName) {
                        child.userData.originalColor = child.material.color.getHex();
                        child.material.color.setHex(0xffff00); // Highlight color
                        child.userData.highlighted = true; // Mark as highlighted
                    }
                }
            });
        }
    }
    
    resetHighlights() {
        this.links.forEach(link => {
            if (link.userData.highlighted) {
                const linkMaterial = link.children[0].material;
                linkMaterial.color.setHex(0x3498DB); // Reset to original color
                linkMaterial.opacity = 1; // Reset opacity
                link.userData.highlighted = false; // Unmark as highlighted
            }
        });
    
        this.tables.forEach(tableObj => {
            tableObj.object.children.forEach(child => {
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry && child.userData.highlighted) {
                    if (child.userData.originalColor) {
                        child.material.color.setHex(child.userData.originalColor);
                    }
                    child.userData.highlighted = false; // Unmark as highlighted
                }
            });
        });
    }

    setupMouseInteraction() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        let hoveredObject = null;

        const onMouseMove = (event) => {
            event.preventDefault();
    
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            const rect = this.renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / this.renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / this.renderer.domElement.clientHeight) * 2 + 1;
    
            // Update the raycaster with the current mouse position
            raycaster.setFromCamera(mouse, this.camera);
    
            // Find intersections with the scene's children
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            // console.log("mouse", mouse.x, intersects.length);  // Log the objects being intersected
    
            if (intersects.length > 0) {
                // iterate through the intersects
                var found = false;
                intersects.forEach(intersect => {
                    // console.log("intersect", intersect.object.userData);
                
                    const object = intersect.object;
                
                    // Check if object has userData for table and column
                    if (object.userData && object.userData.table && object.userData.column) {
                        if (hoveredObject !== object) {
                            if (hoveredObject) {
                                this.resetHighlights();  // Reset previous highlights
                            }
                            hoveredObject = object;  // Set the new hovered object
                            this.highlightConnections(object);  // Highlight the relevant connections
                        }
                        found = true;
                    } 
                    /*   else {
                        if (hoveredObject) {
                            this.resetHighlights();  // Reset if no object is hovered anymore
                            hoveredObject = null;
                        }
                    } */
                });
                if (!found) {
                    if (hoveredObject) {
                        this.resetHighlights();  // Reset if nothing is hovered anymore
                        hoveredObject = null;
                    }
                }
            } else {
                if (hoveredObject) {
                    this.resetHighlights();  // Reset if nothing is hovered
                    hoveredObject = null;
                }
            }
        };

        this.renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    }
}

window.DBSchemaVisualizer = DBSchemaVisualizer;