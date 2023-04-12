  let boid;
  let creatureMeshGroup = new THREE.Group();
  const agentsNumber = 350;
  const informationUpdateRate = 1.0;

  const colorPalette = {
    screenBg: 0xffffff };

  const getRandomNum = (max = 0, min = 0) => Math.floor(Math.random() * (max + 1 - min)) + min;

  const render = () => {
    orbitControls.update();
    boid.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
    /*setTimeout( function() {
          requestAnimationFrame( render );
      }, 1000 / 800 );*/
  };

  const onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  /* datGUI  -------------------------------------------------------------*/
  let gui = new dat.GUI( { autoPlace: true, width: 500 } );
  let guiControls = new function () {
    this.agentsNumber = agentsNumber;
    this.params = {
      maxSpeed: 8,
      maxForce: 0.5,
      interactionRange: 250,
      informationUpdateRate: 1.0};
    }();

  gui.add(guiControls, 'agentsNumber', 3, 1000).onChange( function ( agentsNumber ) {
    creatures = [];
    scene.remove(creatureMeshGroup);

    for (var i = creatureMeshGroup.children.length - 1; i >= 0; i--) {
      creatureMeshGroup.remove(creatureMeshGroup.children[i]);
    }

    for (let i = 0; i < agentsNumber; i++) {
      creature = new Creature(getRandomNum(1), Math.random(), 0); //initial totoalScore = 0
      creatureMeshGroup.add(creature.mesh);
      creatures.push(creature);
    }
    boid = new Boid(creatures);
    scene.add(creatureMeshGroup);
    boid.setBoost();
  });

  gui.add(guiControls.params, 'maxSpeed', 1, 50).onChange( function ( maxSpeed ) {
      boid.setBoost();
  });

  gui.add(guiControls.params, 'maxForce', 0.1, 1.0).onChange( function ( maxForce ) {
      boid.setBoost();
  });

  gui.add(guiControls.params, 'interactionRange', 10, 500).onChange( function ( interactionRange ) {
      boid.setBoost();
  });

  gui.add(guiControls.params, 'informationUpdateRate', 0.0, 1.0).onChange( function( informationUpdateRate ) {
      boid.setBoost();
  });


  class Boid {
    constructor(creatures = []) {
      this.creatures = creatures;
      this.params = guiControls.params;
      this.maxSpeed = guiControls.params.maxSpeed;
    }

    update() {
      this.creatures.forEach(creature => {
       //this.setBoost(); // random walk only
       this.mutateStrategy();
       this.setNextStrategy(creature);
       creature.applyForce(this.interact(creature));
       //creature.applyForce(this.goToCenter(creature));
       creature.update();
      });
    }

    setBoost() {
      this.creatures.forEach(creature => {
        if (creature.boost.length() === 0) {
          if(getRandomNum(10000) < 5)
            creature.boost.x = getRandomNum(1, -1) * 0.1;
          if(getRandomNum(10000) < 5)
            creature.boost.y = getRandomNum(1, -1) * 0.1;
          if(getRandomNum(10000) < 5)
            creature.boost.z = getRandomNum(1, -1) * 0.1;
          creature.boost.normalize();
        creature.boost.multiplyScalar(this.params.maxSpeed);
        }
      });
    }

    seek(currentCreature, target = new THREE.Vector3()) {
      const maxSpeed = this.params.maxSpeed;
      const maxForce = this.params.maxForce;//this.params.seek.maxForce; //0.2
      const toGoalVector = new THREE.Vector3();
      toGoalVector.subVectors(target, currentCreature.mesh.position);
      const distance = toGoalVector.length();
      toGoalVector.normalize();
      toGoalVector.multiplyScalar(maxSpeed);
      const steerVector = new THREE.Vector3();
      steerVector.subVectors(toGoalVector, currentCreature.velocity); // addVectors //ZZZ
      // limit force
      if (steerVector.length() > maxForce) {
        steerVector.clampLength(0, maxForce);
      }
      return steerVector;
    }

    awayFrom(currentCreature, target) {
      const maxSpeed = this.params.maxSpeed;
      const maxForce = this.params.maxForce;//this.params.seek.maxForce;//0.2
      const toGoalVector = new THREE.Vector3();
      toGoalVector.subVectors(currentCreature.mesh.position, target);
      const distance = toGoalVector.length();
      toGoalVector.normalize();
      toGoalVector.multiplyScalar(maxSpeed);
      const steerVector = new THREE.Vector3();
      steerVector.subVectors(toGoalVector, currentCreature.velocity); // addVectors //ZZZ
      // limit force
      if (steerVector.length() > maxForce) {
        steerVector.clampLength(0, maxForce);
      }
      return steerVector;
    }

    goToCenter(currentCreature) {
      const maxSpeed = this.params.maxSpeed;
      const maxForce = this.params.maxForce;
      const interactionRange = this.params.interactionRange;

      const steerVector = new THREE.Vector3();
      const centerVector = new THREE.Vector3(0, 0, 0);
      const toGoalVector = new THREE.Vector3();

      this.creatures.forEach(create => {
        const dist = currentCreature.mesh.position.distanceTo(create.mesh.position);
        if( dist > 0 && dist <= interactionRange ) {
          toGoalVector.subVectors(centerVector, currentCreature.mesh.position);
          toGoalVector.normalize();
          toGoalVector.multiplyScalar(maxSpeed);
          steerVector.subVectors(toGoalVector, currentCreature.velocity);
        }
      });

      if(steerVector.length() > maxForce) {
        steerVector.clampLength(0, maxForce);
      }

      return steerVector;
    }

    mutateStrategy() {
      this.creatures.forEach( creature => {
        let prob = getRandomNum(600000);
        if (prob < 3) {
          let s = getRandomNum(1);
          if (s > 0) { creature.mesh.material.color.setRGB(255, 0, 0); }
          else { creature.mesh.material.color.setRGB(0, 0, 255); }
          creature.strategy = s;
        }
      });
    }

    setNextStrategy(currentCreature) {
      const interactionRange = this.params.interactionRange;
      const informationUpdateRate = this.params.informationUpdateRate;
      let countNeigh = 0;
      let countCoop = 0;
      let ratioOfCoop =  0.0;
      this.creatures.forEach(creature => {
        const dist = currentCreature.mesh.position.distanceTo(creature.mesh.position);
        if( dist > 0 && dist <= interactionRange ) {
          countNeigh++;
          if(currentCreature.strategy == 1) { // if Cooperator
            countCoop++;
          }
        }
      });
      if( countNeigh != 0 ) {
          ratioOfCoop = (countCoop/countNeigh).toFixed(2);
      }

      currentCreature.cooperatorsEstimate += (ratioOfCoop - currentCreature.cooperatorsEstimate) * informationUpdateRate;

      if( currentCreature.cooperatorsEstimate != 0 ) {
        if( currentCreature.cooperatorsEstimate > currentCreature.threshold ) {
          currentCreature.strategy = 1;
        } else {
          currentCreature.strategy = 0;
        }
      }

    }

    interact(currentCreature) {
      const steerVector =  new THREE.Vector3();
      const maxSpeed = this.params.maxSpeed;
      const maxForce = this.params.maxForce;//0.2
      const interactionRange = this.params.interactionRange;
      const attractor = new THREE.Vector3(); // attraction point
      const attractionVector = new THREE.Vector3();
      const repulsor = new THREE.Vector3(); // repulsion point
      const repulsionVector = new THREE.Vector3();

      let countNeigh = 0;
      this.creatures.forEach(creature => {
        let payoff = 0;
        const dist = currentCreature.mesh.position.distanceTo(creature.mesh.position);
        if( dist > 0 && dist <= interactionRange ) {
          attractor.add(creature.mesh.position);
          repulsor.add(creature.mesh.position);
          countNeigh++;
          payoff = ( function(){
            switch (currentCreature.strategy) {
              case 1: if(creature.strategy == 1)
                        return 1;
                      else return -1.4;
                break;
              case 0: if(creature.strategy == 1)
                        return 1.8;
                      else return -1;
                    break;
              default: return 0;
                        break;
            }})();
          //currentCreature.totalScore += (payoff / dist).toFixed(4);
          let payDist = payoff / dist;
          currentCreature.totalScore = currentCreature.totalScore + payDist;
          console.log(dist);
        }
      });
      if ( countNeigh != 0 ) {
        if( currentCreature.totalScore >= -30 ) {
          // attraction
          attractor.divideScalar(countNeigh);
          steerVector.add(this.seek(currentCreature, attractor));
        } else {
          // repulsion
          repulsor.divideScalar(countNeigh);
          steerVector.add(this.avoid(currentCreature, repulsor));
        }
      } else {
          this.creatures.forEach(creature => {
            if (creature.boost.length() === 0) {
              if(getRandomNum(10000) < 5)
                creature.boost.x = getRandomNum(1, -1) * 0.1;
              if(getRandomNum(10000) < 5)
                creature.boost.y = getRandomNum(1, -1) * 0.1;
              if(getRandomNum(10000) < 5)
                creature.boost.z = getRandomNum(1, -1) * 0.1;
              creature.boost.normalize();
            creature.boost.multiplyScalar(this.params.maxSpeed);
            }
          })
      }
      if(steerVector.length() > maxForce) {
        steerVector.clampLength(0, maxForce);
      }
      return steerVector;
    }

    awayFromCenter(currentCreature) {
      const maxSpeed = this.params.maxSpeed;
      const maxForce = this.params.maxForce;//0.2;

      const steerVector = new THREE.Vector3();
      const centerVector = new THREE.Vector3(0, 0, 0);
      const toGoalVector = new THREE.Vector3();
      toGoalVector.subVectors(currentCreature.mesh.position, centerVector);
      toGoalVector.normalize();
      toGoalVector.multiplyScalar(maxSpeed);
      steerVector.subVectors(toGoalVector, currentCreature.velocity);

      if(steerVector.length() > maxForce) {
        steerVector.clampLength(0, maxForce);
      }

      return steerVector;
    }

    avoid(currentCreature, wall = new THREE.Vector3()) {
      currentCreature.mesh.geometry.computeBoundingSphere();
      const boundingSphere = currentCreature.mesh.geometry.boundingSphere;

      const toMeVector = new THREE.Vector3();
      toMeVector.subVectors(currentCreature.mesh.position, wall);

      const distance = toMeVector.length() - boundingSphere.radius * 2;
      const steerVector = toMeVector.clone();
      steerVector.normalize();
      steerVector.multiplyScalar(1 / Math.pow(distance, 2));
      return steerVector;
    }
  }

  class Creature {
    constructor(strategy, threshold, totalScore) {
      const geometry = new THREE.CylinderGeometry(1, 8, 25, 12);
      //const geometry = new THREE.SphereGeometry( 5, 32, 32 );

      geometry.rotateX(THREE.Math.degToRad(90));

      this.strategy = strategy;
      this.threshold = threshold;
      this.totalScore = totalScore;

      let cooperatorsEstimate = 0;
      const color = new THREE.Color();

      if (strategy > 0) {
          color.setRGB(0, 0, 255);
      } else {
          color.setRGB(255, 0, 0);
      }

      const material = new THREE.MeshMatcapMaterial({
                wireframe: false,
                color: color });

      this.mesh = new THREE.Mesh(geometry, material);
      const radius = getRandomNum(500, 1000);
      const theta = THREE.Math.degToRad(getRandomNum(180));
      const phi = THREE.Math.degToRad(getRandomNum(360));
      this.mesh.position.x = Math.sin(theta) * Math.cos(phi) * radius;
      this.mesh.position.y = Math.sin(theta) * Math.sin(phi) * radius;
      this.mesh.position.z = Math.cos(theta) * radius;
      this.velocity = new THREE.Vector3(getRandomNum(100, -100) * 0.1, getRandomNum(100, -100) * 0.1, getRandomNum(100, -100) * 0.1);
      this.acceleration = new THREE.Vector3();
      this.wonderTheta = 0;
      this.maxSpeed = guiControls.params.maxSpeed;
      this.maxForce = guiControls.params.maxForce;
      this.interactionRange = guiControls.params.interactionRange;
      // set agents with pre-set speed from the guiControls
      this.boost = new THREE.Vector3(getRandomNum(1, -1) * 0.1,
                                      getRandomNum(1, -1) * 0.1,
                                    getRandomNum(1, -1) * 0.1);
      this.boost.normalize();
      this.boost.multiplyScalar(guiControls.params.maxSpeed);

      this.agentsNumber = guiControls.params.agentsNumber;
    }

    applyForce(f) {
      this.acceleration.add(f.clone());
    }

    update() {
      const maxSpeed = this.maxSpeed;

      // boost
      this.applyForce(this.boost);
      this.boost.multiplyScalar(0.2);// 0.2
      if (this.boost.length() < 0.01) {//0.01
        this.boost = new THREE.Vector3();
      }

      // update velocity
      this.velocity.add(this.acceleration);

      // limit velocity
      if (this.velocity.length() > maxSpeed) {
        this.velocity.clampLength(0, maxSpeed);
      }

      // update position
      this.mesh.position.add(this.velocity);

      // reset acc
      this.acceleration.multiplyScalar(0);

      // head
      const head = this.velocity.clone();
      head.multiplyScalar(3);//10
      head.add(this.mesh.position);
      this.mesh.lookAt(head);

    }}

  /* scene
       -------------------------------------------------------------*/
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(colorPalette.screenBg, 3000, 20000);

  /* camera
                                                                 -------------------------------------------------------------*/
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.x = 0;
  camera.position.y = 0;
  camera.position.z = 1800; //2800 // ZZZ
  camera.lookAt(scene.position);
  scene.add(camera);

  /* renderer
                     -------------------------------------------------------------*/
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(new THREE.Color(colorPalette.screenBg));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;


  /* creature
    -------------------------------------------------------------*/
  const generateBoid = () => {
    const creatures = [];
    scene.remove(creatureMeshGroup);
    creatureMeshGroup = new THREE.Group();
    for (let i = 0; i < agentsNumber; i++) {
      //const creature = new Creature();
      let strategy_ = getRandomNum(1);
      let threshold_ = Math.random(); // totalScore = 0
      const creature = new Creature(strategy_, threshold_, 0); // totalScore = 0

      creature.threshold = Math.random().toFixed(3);
      creature.cooperatorsEstimate = 0;
      creature.totalScore = 0;

      creatureMeshGroup.add(creature.mesh);
      creatures.push(creature);
    }
    boid = new Boid(creatures);
    scene.add(creatureMeshGroup);
  };
  generateBoid();

  /* OrbitControls
                  -------------------------------------------------------------*/
  const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
  orbitControls.autoRotate = false;
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.39;

  /* resize
                                      -------------------------------------------------------------*/
  window.addEventListener('resize', onResize);

  /* rendering start
                                               -------------------------------------------------------------*/
  document.getElementById('WebGL-output').appendChild(renderer.domElement);
  render();
