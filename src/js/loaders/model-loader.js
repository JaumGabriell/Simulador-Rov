// ═══════════════════════════════════════════════════════════════════════════
// ALPHA SUBSEA - ROV SIMULATOR
// Carregador de Modelos 3D (STL, OBJ, GLTF)
// ═══════════════════════════════════════════════════════════════════════════

export class ModelLoader {
  constructor(simulator) {
    this.simulator = simulator;
    this.loadedModels = new Map();
  }

  async loadSTL(url, options = {}) {
    const STLLoader = await this.getSTLLoader();
    if (!STLLoader) {
      console.warn("STLLoader not available");
      return null;
    }

    return new Promise((resolve, reject) => {
      const loader = new STLLoader();

      loader.load(
        url,
        (geometry) => {
          // Centralizar geometria
          geometry.center();
          geometry.computeBoundingBox();

          // Calcular escala
          const bbox = geometry.boundingBox;
          const size = new THREE.Vector3();
          bbox.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = (options.targetSize || 1.0) / maxDim;

          // Criar material
          const material = new THREE.MeshStandardMaterial({
            color: options.color || 0xffaa00,
            metalness: options.metalness || 0.6,
            roughness: options.roughness || 0.4,
          });

          // Criar mesh
          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.set(scale, scale, scale);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          // Aplicar rotação se especificada
          if (options.rotation) {
            mesh.rotation.set(
              options.rotation.x || 0,
              options.rotation.y || 0,
              options.rotation.z || 0
            );
          }

          this.loadedModels.set(url, mesh);
          resolve(mesh);
        },
        (progress) => {
          if (progress.lengthComputable && options.onProgress) {
            const percent = (progress.loaded / progress.total) * 100;
            options.onProgress(percent);
          }
        },
        (error) => {
          console.warn(`Could not load STL model from ${url}:`, error.message);
          reject(error);
        }
      );
    });
  }

  async getSTLLoader() {
    if (THREE.STLLoader) {
      return THREE.STLLoader;
    }

    // Criar STLLoader inline
    return new Promise((resolve) => {
      class STLLoader extends THREE.Loader {
        constructor(manager) {
          super(manager);
        }

        load(url, onLoad, onProgress, onError) {
          const loader = new THREE.FileLoader(this.manager);
          loader.setPath(this.path);
          loader.setResponseType("arraybuffer");
          loader.setRequestHeader(this.requestHeader);
          loader.setWithCredentials(this.withCredentials);
          loader.load(
            url,
            (buffer) => {
              try {
                onLoad(this.parse(buffer));
              } catch (e) {
                if (onError) onError(e);
                else console.error(e);
                this.manager.itemError(url);
              }
            },
            onProgress,
            onError
          );
        }

        parse(data) {
          const isBinary = (data) => {
            const reader = new DataView(data);
            const face_size = (32 / 8) * 3 + (32 / 8) * 3 * 3 + 16 / 8;
            const n_faces = reader.getUint32(80, true);
            const expect = 80 + 32 / 8 + n_faces * face_size;
            if (expect === reader.byteLength) return true;
            const solid = [115, 111, 108, 105, 100];
            for (let off = 0; off < 5; off++) {
              if (solid[off] !== reader.getUint8(off)) return true;
            }
            return false;
          };

          const binData = this.ensureBinary(data);
          return isBinary(binData)
            ? this.parseBinary(binData)
            : this.parseASCII(this.ensureString(data));
        }

        ensureBinary(buffer) {
          if (typeof buffer === "string") {
            const array_buffer = new Uint8Array(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
              array_buffer[i] = buffer.charCodeAt(i) & 0xff;
            }
            return array_buffer.buffer || array_buffer;
          }
          return buffer;
        }

        ensureString(buffer) {
          if (typeof buffer !== "string") {
            return new TextDecoder().decode(buffer);
          }
          return buffer;
        }

        parseBinary(data) {
          const reader = new DataView(data);
          const faces = reader.getUint32(80, true);

          const geometry = new THREE.BufferGeometry();
          const vertices = new Float32Array(faces * 3 * 3);
          const normals = new Float32Array(faces * 3 * 3);

          for (let face = 0; face < faces; face++) {
            const start = 84 + face * 50;
            const normalX = reader.getFloat32(start, true);
            const normalY = reader.getFloat32(start + 4, true);
            const normalZ = reader.getFloat32(start + 8, true);

            for (let i = 1; i <= 3; i++) {
              const vertexstart = start + i * 12;
              const componentIdx = face * 3 * 3 + (i - 1) * 3;

              vertices[componentIdx] = reader.getFloat32(vertexstart, true);
              vertices[componentIdx + 1] = reader.getFloat32(
                vertexstart + 4,
                true
              );
              vertices[componentIdx + 2] = reader.getFloat32(
                vertexstart + 8,
                true
              );

              normals[componentIdx] = normalX;
              normals[componentIdx + 1] = normalY;
              normals[componentIdx + 2] = normalZ;
            }
          }

          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(vertices, 3)
          );
          geometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(normals, 3)
          );

          return geometry;
        }

        parseASCII(data) {
          const geometry = new THREE.BufferGeometry();
          const patternFace = /facet([\s\S]*?)endfacet/g;
          const patternNormal =
            /normal[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;
          const patternVertex =
            /vertex[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

          const vertices = [];
          const normals = [];

          let result;
          while ((result = patternFace.exec(data)) !== null) {
            let normalX = 0,
              normalY = 0,
              normalZ = 1;
            const normalResult = patternNormal.exec(result[0]);
            if (normalResult) {
              normalX = parseFloat(normalResult[1]);
              normalY = parseFloat(normalResult[3]);
              normalZ = parseFloat(normalResult[5]);
            }

            let vertexResult;
            while ((vertexResult = patternVertex.exec(result[0])) !== null) {
              vertices.push(
                parseFloat(vertexResult[1]),
                parseFloat(vertexResult[3]),
                parseFloat(vertexResult[5])
              );
              normals.push(normalX, normalY, normalZ);
            }
          }

          geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3)
          );
          geometry.setAttribute(
            "normal",
            new THREE.Float32BufferAttribute(normals, 3)
          );

          return geometry;
        }
      }

      THREE.STLLoader = STLLoader;
      resolve(STLLoader);
    });
  }

  async loadROVModel() {
    try {
      console.log("Loading Alpha Subsea ROV model (APH-DE3339)...");

      const mesh = await this.loadSTL("/models/rov_omega.stl", {
        targetSize: 1.0,
        color: 0xffaa00,
        metalness: 0.6,
        roughness: 0.4,
        rotation: { x: -Math.PI / 2, y: 0, z: Math.PI / 2 },
        onProgress: (percent) => {
          console.log(`Loading ROV model: ${percent.toFixed(0)}%`);
        },
      });

      console.log("Alpha Subsea ROV STL model loaded successfully!");
      return mesh;
    } catch (error) {
      console.warn(
        "Could not load ROV STL model, using fallback:",
        error.message
      );
      return null;
    }
  }

  getLoadedModel(url) {
    return this.loadedModels.get(url);
  }

  disposeModel(url) {
    const model = this.loadedModels.get(url);
    if (model) {
      if (model.geometry) model.geometry.dispose();
      if (model.material) model.material.dispose();
      this.loadedModels.delete(url);
    }
  }

  disposeAll() {
    this.loadedModels.forEach((model, url) => {
      this.disposeModel(url);
    });
  }
}

export default ModelLoader;
