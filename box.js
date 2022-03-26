import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.module.js";

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 100);
camera.position.set(0, -2.55, 2.55);
let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor('#e5e5e5');
document.body.appendChild(renderer.domElement);

window.addEventListener( 'resize', onWindowResize );

//aqui las luces
const light= new THREE.PointLight(0xFFFFFF,1,500);
light.position.set(5,10,25);
scene.add(light);

//coordenadas
const axesHelper = new THREE.AxesHelper( 2 );
scene.add( axesHelper );

//aqui el objeto-----
const planeGeometry = new THREE.PlaneGeometry(1, 1, 1388, 1040)
const materialplan = new THREE.MeshPhongMaterial()
//cargar mapa de desplazamiento
const displacementMap = new THREE.TextureLoader().load('topografia2.jpg')
materialplan.displacementMap = displacementMap
materialplan.displacementScale=0.7;

//cargar textura
const texture = new THREE.TextureLoader().load('focalizada2.jpg')
materialplan.map = texture;
const plane = new THREE.Mesh(planeGeometry, materialplan);
plane.roughnessMap=2;
plane.bumpScale=2;
//plane.rotation.x=-Math.PI/2;
scene.add(plane);


let controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance=1.5;
controls.maxDistance=6;
//cargar grid
let grid = new THREE.GridHelper(2, 20, 0x202020, 0x202020);
grid.position.z = -0.01;
grid.rotation.x=-Math.PI/2;
scene.add(grid);

//aqui el gui
const gui = new GUI();
let folderObj=gui.addFolder("Object")
folderObj.add(plane.material,"displacementScale",0.2,1,0.05).name("Roughness: ");
folderObj.add(plane.rotation,"z",0,Math.PI*2,Math.PI*2/8).name("Rotation Y: ");
let folderBox=gui.addFolder("Container");
folderBox.add(grid.position,"z",0,1,0.1).name("Position Grid Z");
let folderAxes=gui.addFolder("Axes");
folderAxes.add(axesHelper,"visible");

//aqui la caja

let box = DashedHiddenEdgesBox(4, 2.2, 0.2, "color");
box.geometry.translate(0, 0, 0);
scene.add(box);

renderer.setAnimationLoop((_) => {
  renderer.render(scene, camera);
});

function DashedHiddenEdgesBox(w, h, d, color) {
  //box base points
  let basePts = [
    [0, 0, 0],[1, 0, 0],[1, 0, 1],[0, 0, 1],
    [0, 1, 0],[1, 1, 0],[1, 1, 1],[0, 1, 1]
  ].map(p => {return new THREE.Vector3(p[0], p[1], p[2])});
  // box sides normals
  let baseNor = [
    [0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 1, 0], [0, -1, 0] 
  ].map(n => {return new THREE.Vector3(n[0], n[1], n[2])});
  
  let pts = [];
  let n1 = [];
  let n2 = [];
  
  //bottom
  for(let i = 0; i < 4; i++){
    // bottom
    pts.push(basePts[i].clone());
    pts.push(basePts[(i + 1) > 3 ? 0 : (i + 1)].clone());
    n1.push(baseNor[i].x, baseNor[i].y, baseNor[i].z,baseNor[i].x, baseNor[i].y, baseNor[i].z);
    n2.push(baseNor[5].x, baseNor[5].y, baseNor[5].z,baseNor[5].x, baseNor[5].y, baseNor[5].z);
    // top
    pts.push(basePts[4 + i].clone());
    pts.push(basePts[(4 + i + 1) > 7 ? 4 : (4 + i + 1)].clone());
    n1.push(baseNor[i].x, baseNor[i].y, baseNor[i].z,baseNor[i].x, baseNor[i].y, baseNor[i].z);
    n2.push(baseNor[4].x, baseNor[4].y, baseNor[4].z,baseNor[4].x, baseNor[4].y, baseNor[4].z);
    // middle
    pts.push(basePts[i].clone());
    pts.push(basePts[i + 4].clone());
    n1.push(baseNor[i].x, baseNor[i].y, baseNor[i].z,baseNor[i].x, baseNor[i].y, baseNor[i].z);
    let prev = (i - 1) < 0 ? 3 : (i - 1);
    n2.push(baseNor[prev].x, baseNor[prev].y, baseNor[prev].z,baseNor[prev].x, baseNor[prev].y, baseNor[prev].z);
  }
  //console.log(pts)
  
  let g = new THREE.BufferGeometry().setFromPoints(pts);
  g.setAttribute("n1", new THREE.Float32BufferAttribute(n1, 3));
  g.setAttribute("n2", new THREE.Float32BufferAttribute(n2, 3));
  g.translate(-0.5, -0.5, -0.5);
  g.scale(w, h, d);
  let m = new THREE.LineDashedMaterial({
    color: 0x202020, 
    dashSize: 0.3, 
    gapSize: 0.14,
    onBeforeCompile: shader => {
      shader.vertexShader = `
        attribute vec3 n1;
        attribute vec3 n2;
        varying float isDashed;
        ${shader.vertexShader}
      `.replace(
        `#include <fog_vertex>`,
        `#include <fog_vertex>
        
          vec3 nor1 = normalize(normalMatrix * n1);
          vec3 nor2 = normalize(normalMatrix * n2);
          vec3 vDir = normalize(mvPosition.xyz);
          //vDir = vec3(0, 0, -1);
          float v1 = step( 0., dot( vDir, nor1 ) );
          float v2 = step( 0., dot( vDir, nor2 ) );
          isDashed = min(v1, v2);
        `
      );
      console.log(shader.vertexShader);
      shader.fragmentShader = `
        varying float isDashed;
        ${shader.fragmentShader}
      `.replace(
        `if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}`,
        `
          if ( isDashed > 0.0 ) {
            if ( mod( vLineDistance, totalSize ) > dashSize ) {
              discard;
            }
          }`
      );
      console.log(shader.fragmentShader)
    }
  });
  let l = new THREE.LineSegments(g, m);
  l.computeLineDistances();
  return l;
}

function onWindowResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(innerWidth, innerHeight);
}
folderBox.add(box,"visible");//colocar visible la caja
