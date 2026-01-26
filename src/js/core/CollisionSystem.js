// Sistema de Colisão por Raycasting para ROV
// Detecta colisões do ROV com o ambiente usando raios em múltiplas direções
export class CollisionSystem {
  /**
   * Construtor do sistema de colisão.
   *
   * @param {THREE.Scene} scene - Cena Three.js onde os objetos 3D existem.
   * @param {THREE.Object3D} rovModel - Modelo 3D do ROV (usado como origem dos raios e para debug visual).
   */
  constructor(scene, rovModel) {
    // Cena Three.js onde os objetos 3D existem
    this.scene = scene;
    // Modelo 3D do ROV (usado como origem dos raios e para debug visual)
    this.rovModel = rovModel;
    // Ferramenta do Three.js para lançar raios e detectar interseções
    this.raycaster = new THREE.Raycaster();

    // Configurações do sistema de colisão
    /**
     * Distância mínima antes de colidir (metros).
     * @type {number}
     */
    this.collisionDistance = 0.3;
    /**
     * Força para empurrar o ROV quando colidir.
     * @type {number}
     */
    this.pushForce = 0.1;
    /**
     * Sistema ativo/desativado.
     * @type {boolean}
     */
    this.enabled = true;
    /**
     * Mostrar raios visualmente.
     * @type {boolean}
     */
    this.showDebug = false;

    // Array de raios em múltiplas direções para detecção de colisão
    /**
     * Raios em múltiplas direções para detecção de colisão.
     * @type {Array<{name: string, vector: THREE.Vector3, color: number}>}
     */
    this.rays = [
      // Raios principais (6 direções ortogonais)
      { name: "forward", vector: new THREE.Vector3(1, 0, 0), color: 0x000000 }, // Frente (eixo X positivo)
      {
        name: "backward",
        vector: new THREE.Vector3(-1, 0, 0),
        color: 0x000000,
      }, // Trás (eixo X negativo)
      { name: "left", vector: new THREE.Vector3(0, 0, -1), color: 0x000000 }, // Esquerda (eixo Z negativo)
      { name: "right", vector: new THREE.Vector3(0, 0, 1), color: 0x000000 }, // Direita (eixo Z positivo)
      { name: "up", vector: new THREE.Vector3(0, 1, 0), color: 0x000000 }, // Cima (eixo Y positivo) - Magenta
      { name: "down", vector: new THREE.Vector3(0, -1, 0), color: 0x000000 }, // Baixo (eixo Y negativo) - Ciano

      // Raios diagonais horizontais (4 direções a 45°)
      // 0.707 ≈ 1/√2 (normalização de vetor diagonal)
      {
        name: "forward-left",
        vector: new THREE.Vector3(0.707, 0, -0.707),
        color: 0x000000,
      }, // Frente-esquerda
      {
        name: "forward-right",
        vector: new THREE.Vector3(0.707, 0, 0.707),
        color: 0x000000,
      }, // Frente-direita
      {
        name: "backward-left",
        vector: new THREE.Vector3(-0.707, 0, -0.707),
        color: 0x000000,
      }, // Trás-esquerda
      {
        name: "backward-right",
        vector: new THREE.Vector3(-0.707, 0, 0.707),
        color: 0x000000,
      }, // Trás-direita

      // Diagonais verticais
      {
        name: "up-forward",
        vector: new THREE.Vector3(0.707, 0.707, 0),
        color: 0x000000,
      }, // Cima-frente
      {
        name: "down-forward",
        vector: new THREE.Vector3(0.707, -0.707, 0),
        color: 0x000000,
      }, // Baixo-frente

      {
        name: "up-back",
        vector: new THREE.Vector3(-0.707, 0.707, 0),
        color: 0x000000,
      }, // Cima-frente
      {
        name: "down-back",
        vector: new THREE.Vector3(-0.707, -0.707, 0),
        color: 0x000000,
      }, // Baixo-frente

      { name: "left", vector: new THREE.Vector3(0, 0.707, -1), color: 0x000000 }, // esquerda diagonal pra cima
      { name: "left", vector: new THREE.Vector3(0, -0.707, -1), color: 0x000000 }, // esquerda diagonal pra baixo
      { name: "left", vector: new THREE.Vector3(0, 0.707, 1), color: 0x000000 }, // direita diagonal pra cima
      { name: "left", vector: new THREE.Vector3(0, -0.707, 1), color: 0x000000 }, // direita diagonal pra baixo
    ];

    // Array para armazenar helpers visuais (linhas) para debug
    this.debugHelpers = [];
    // Se debug estiver ativo, criar helpers visuais imediatamente
    if (this.showDebug) {
      this.createDebugHelpers();
    }

    // Array de objetos 3D que podem colidir com os raios
    this.collidableObjects = [];
  }

  /**
   * Adiciona objeto 3D (e seus filhos) à lista de objetos colidíveis.
   * Percorre recursivamente o objeto e adiciona todos os meshes.
   *
   * @param {THREE.Object3D} object - Objeto 3D a ser adicionado (ex: modelo do cenário).
   */
  addCollidableObject(object) {
    // Array temporário para armazenar meshes encontrados
    const meshes = [];

    // Percorre recursivamente todos os filhos do objeto
    object.traverse((child) => {
      // Se o filho for um mesh (tem geometria para colisão), adiciona ao array
      if (child.isMesh) {
        meshes.push(child);
      }
    });

    // Concatena os novos meshes com os existentes
    this.collidableObjects = this.collidableObjects.concat(meshes);

    // Log informativo mostrando quantos meshes foram adicionados
    console.log(`Sistema de colisão: ${meshes.length} meshes adicionados`);
  }

  /**
   * Cria helpers visuais (linhas coloridas) para visualizar os raios de colisão.
   * Útil para debug e entender como o sistema está funcionando.
   */
  createDebugHelpers() {
    console.log("Criando helpers de debug para colisão...");

    // Limpar helpers anteriores para evitar duplicação
    this.debugHelpers.forEach((helper) => {
      // Remove helper do modelo do ROV
      this.rovModel.remove(helper);
      // Libera memória da geometria
      if (helper.geometry) helper.geometry.dispose();
      // Libera memória do material
      if (helper.material) helper.material.dispose();
    });
    // Reset array de helpers
    this.debugHelpers = [];

    // Para cada raio definido no sistema, cria uma linha visual
    this.rays.forEach((ray) => {
      // Define os pontos da linha: origem (0,0,0) e direção do raio
      const points = [
        new THREE.Vector3(0, 0, 0), // Origem no centro do ROV
        ray.vector.clone().multiplyScalar(this.collisionDistance * 2), // Extremidade do raio (2x a distância de colisão para melhor visualização)
      ];

      // Cria geometria da linha a partir dos pontos
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      // Cria material visual da linha com cor específica
      const material = new THREE.LineBasicMaterial({
        color: ray.color, // Cor definida para cada direção
        linewidth: 2, // Espessura da linha (visual, pode não funcionar em todos os sistemas)
        opacity: 0.8, // Transparência
        transparent: true, // Habilita transparência
      });

      // Cria objeto de linha Three.js
      const line = new THREE.Line(geometry, material);

      // Nomeia a linha para fácil identificação no scene graph
      line.name = `collision-ray-${ray.name}`;

      // Adiciona ao array de helpers
      this.debugHelpers.push(line);

      // Adiciona visualmente ao modelo do ROV (segue o ROV)
      this.rovModel.add(line);
    });

    // Log informativo mostrando quantos raios foram criados
    console.log(`${this.debugHelpers.length} raios de debug criados`);
  }

  /**
   * Método principal: verifica colisões em todas as direções e retorna vetor de correção.
   *
   * @param {THREE.Vector3} rovPosition - Posição atual do ROV no espaço 3D.
   * @param {THREE.Euler} rovRotation - Rotação atual do ROV (para orientar os raios).
   * @returns {THREE.Vector3} Vetor de correção para afastar o ROV das colisões.
   */
  checkCollisions(rovPosition, rovRotation) {
    // Se sistema desabilitado ou não há objetos colidíveis, retorna vetor nulo (sem correção)
    if (!this.enabled || this.collidableObjects.length === 0) {
      return new THREE.Vector3(0, 0, 0); // Sem correção necessária
    }

    // Vetor que acumula todas as forças de correção de colisão
    const correctionVector = new THREE.Vector3(0, 0, 0);

    // Converte rotação Euler para Quaternion (mais eficiente para rotações 3D)
    const quaternion = new THREE.Quaternion().setFromEuler(rovRotation);

    // Itera sobre cada raio definido no sistema
    this.rays.forEach((ray, index) => {
      // Clona a direção base do raio para não modificar o original
      let direction = ray.vector.clone();

      // IMPORTANTE: Raios verticais (up/down) NÃO rotacionam com o ROV
      // Eles devem sempre apontar para cima/baixo no espaço global, não seguir orientação do ROV
      if (ray.name !== "up" && ray.name !== "down") {
        // Aplica rotação do ROV ao raio (exceto verticais)
        direction.applyQuaternion(quaternion);
      }

      // Configura o raycaster com origem na posição do ROV e direção calculada
      this.raycaster.set(rovPosition, direction);

      // Define distância máxima do raio (quão longe ele detecta colisões)
      this.raycaster.far = this.collisionDistance;

      // Lança o raio e detecta interseções com todos os objetos colidíveis
      // false = não verificar descendentes (já estamos verificando meshes individuais)
      const intersections = this.raycaster.intersectObjects(
        this.collidableObjects,
        false,
      );

      // Se houver interseções (raio bateu em algo)
      if (intersections.length > 0) {
        // Pega a primeira (mais próxima) interseção
        const distance = intersections[0].distance;
        const hitObject = intersections[0].object.name || "unnamed";

        // Debug: mostra no console qual objeto foi atingido (apenas para raios verticais)
        if (ray.name === "up" || ray.name === "down") {
          console.log(
            `Raio ${ray.name} atingiu: ${hitObject} a ${distance.toFixed(2)}m`,
          );
        }

        // Se a distância for menor que a distância de colisão configurada
        if (distance < this.collisionDistance) {
          // Calcula quanto o ROV precisa ser empurrado para trás
          const pushBack = this.collisionDistance - distance;

          // Calcula direção de empurrão (oposta à direção do raio)
          const pushDirection = direction
            .clone()
            .multiplyScalar(-pushBack * this.pushForce);

          // Adiciona esta força de correção ao vetor total
          correctionVector.add(pushDirection);

          // Feedback visual: muda cor do raio para vermelho indicando colisão
          if (this.showDebug && this.debugHelpers[index]) {
            this.debugHelpers[index].material.color.setHex(0xff0000); // Vermelho = colisão detectada
          }
        }
      } else {
        // Se não houve colisão, mantém cor original do raio
        if (this.showDebug && this.debugHelpers[index]) {
          this.debugHelpers[index].material.color.setHex(ray.color); // Cor original = sem colisão
        }
      }
    });

    // Retorna vetor de correção acumulado (será aplicado à posição do ROV)
    return correctionVector;
  }

  /**
   * Atualiza a posição dos helpers visuais para seguir o ROV.
   * Chamado a cada frame para manter os raios visuais sincronizados com a posição do ROV.
   *
   * @param {THREE.Vector3} rovPosition - Posição atual do ROV.
   */
  updateDebugHelpers(rovPosition) {
    // Só atualiza se debug estiver ativo e houver helpers criados
    if (this.showDebug && this.debugHelpers.length > 0) {
      // Para cada helper visual (linha de raio)
      this.debugHelpers.forEach((helper) => {
        // Copia a posição do ROV para o helper
        // Isso faz as linhas seguirem o ROV onde quer que ele vá
        helper.position.copy(rovPosition);
      });
    }
  }

  /**
   * Alterna (liga/desliga) a visualização dos raios de debug.
   * Permite ativar/desativar os raios visuais em tempo de execução.
   */
  toggleDebug() {
    // Inverte o estado atual do debug
    this.showDebug = !this.showDebug;

    // Se acabou de ativar o debug e não há helpers criados
    if (this.showDebug && this.debugHelpers.length === 0) {
      // Cria os helpers visuais
      this.createDebugHelpers();
    }
    // Se acabou de desativar o debug e há helpers existentes
    else if (!this.showDebug && this.debugHelpers.length > 0) {
      // Remove todos os helpers visuais do ROV
      this.debugHelpers.forEach((helper) => {
        this.rovModel.remove(helper);
      });
      // Limpa o array de helpers
      this.debugHelpers = [];
    }
  }

  /**
   * Limpa todos os recursos do sistema de colisão.
   * Importante para liberar memória e evitar memory leaks.
   * Deve ser chamado quando o sistema não for mais usado.
   */
  dispose() {
    // Para cada helper visual
    this.debugHelpers.forEach((helper) => {
      // Libera memória da geometria do helper
      if (helper.geometry) helper.geometry.dispose();
      // Libera memória do material do helper
      if (helper.material) helper.material.dispose();
      // Remove helper da cena (do modelo do ROV)
      this.rovModel.remove(helper);
    });

    // Limpa array de helpers
    this.debugHelpers = [];

    // Limpa array de objetos colidíveis
    this.collidableObjects = [];

    // Log informativo
    console.log("Sistema de colisão limpo e recursos liberados");
  }
}
