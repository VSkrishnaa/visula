import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';

const TorchQuaternionCalculator = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const [results, setResults] = useState(null);
  const [parameters, setParameters] = useState({
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    radius: 1.0,
    normalX: 0,
    normalY: 0,
    normalZ: 1,
    torchAngle: 30,
    numPoints: 8
  });

  // Quaternion calculation function
  const calculateTorchQuaternions = (centerPoint, radius, normalVector, torchAngle, numPoints) => {
    const results = [];
    
    // Normalize the normal vector
    const normal = new THREE.Vector3(normalVector[0], normalVector[1], normalVector[2]).normalize();
    
    // Create two orthogonal vectors in the plane
    let tangent1, tangent2;
    
    // Choose an arbitrary vector not parallel to normal
    if (Math.abs(normal.x) < 0.9) {
      tangent1 = new THREE.Vector3(1, 0, 0);
    } else {
      tangent1 = new THREE.Vector3(0, 1, 0);
    }
    
    // Make tangent1 orthogonal to normal using Gram-Schmidt
    tangent1.sub(normal.clone().multiplyScalar(tangent1.dot(normal))).normalize();
    
    // Create second tangent vector
    tangent2 = new THREE.Vector3().crossVectors(normal, tangent1).normalize();
    
    const center = new THREE.Vector3(centerPoint[0], centerPoint[1], centerPoint[2]);
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints;
      
      // Calculate position on circle
      const position = center.clone()
        .add(tangent1.clone().multiplyScalar(radius * Math.cos(angle)))
        .add(tangent2.clone().multiplyScalar(radius * Math.sin(angle)));
      
      // Calculate tangent to circle at this point
      const circularTangent = tangent1.clone().multiplyScalar(-Math.sin(angle))
        .add(tangent2.clone().multiplyScalar(Math.cos(angle)));
      
      // Calculate torch direction (tilted from normal by torchAngle towards the tangent)
      const torchDirection = normal.clone().multiplyScalar(Math.cos(torchAngle))
        .add(circularTangent.clone().multiplyScalar(Math.sin(torchAngle)));
      
      // Create coordinate frame for torch
      const zAxis = torchDirection.clone().normalize();
      const xAxis = circularTangent.clone().normalize();
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
      
      // Create rotation matrix
      const rotationMatrix = new THREE.Matrix3();
      rotationMatrix.set(
        xAxis.x, yAxis.x, zAxis.x,
        xAxis.y, yAxis.y, zAxis.y,
        xAxis.z, yAxis.z, zAxis.z
      );
      
      // Convert to quaternion
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().setFromMatrix3(rotationMatrix)
      );
      
      results.push({
        position: [position.x, position.y, position.z],
        quaternion: [quaternion.w, quaternion.x, quaternion.y, quaternion.z],
        torchDirection: [zAxis.x, zAxis.y, zAxis.z],
        tangent: [xAxis.x, xAxis.y, xAxis.z],
        normal: [normal.x, normal.y, normal.z],
        angleFromNormal: Math.acos(zAxis.dot(normal)) * 180 / Math.PI
      });
    }
    
    return results;
  };

  const handleCalculate = () => {
    const centerPoint = [parameters.centerX, parameters.centerY, parameters.centerZ];
    const normalVector = [parameters.normalX, parameters.normalY, parameters.normalZ];
    const torchAngleRad = parameters.torchAngle * Math.PI / 180;
    
    const calculatedResults = calculateTorchQuaternions(
      centerPoint,
      parameters.radius,
      normalVector,
      torchAngleRad,
      parameters.numPoints
    );
    
    setResults(calculatedResults);
    visualizeResults(calculatedResults, centerPoint, normalVector, parameters.radius);
  };

  const visualizeResults = (results, centerPoint, normalVector, radius) => {
    if (!sceneRef.current) return;
    
    // Clear previous visualization
    while(sceneRef.current.children.length > 0) {
      sceneRef.current.remove(sceneRef.current.children[0]);
    }
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    sceneRef.current.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    sceneRef.current.add(directionalLight);
    
    // Draw coordinate axes
    const axesHelper = new THREE.AxesHelper(radius * 1.5);
    sceneRef.current.add(axesHelper);
    
    // Draw circular trajectory
    const circleGeometry = new THREE.RingGeometry(radius * 0.98, radius * 1.02, 64);
    const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    
    // Orient circle according to normal vector
    const normal = new THREE.Vector3(normalVector[0], normalVector[1], normalVector[2]).normalize();
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
    circle.setRotationFromQuaternion(quaternion);
    circle.position.set(centerPoint[0], centerPoint[1], centerPoint[2]);
    sceneRef.current.add(circle);
    
    // Draw normal vector at center
    const normalArrow = new THREE.ArrowHelper(
      normal,
      new THREE.Vector3(centerPoint[0], centerPoint[1], centerPoint[2]),
      radius * 0.8,
      0x0000ff,
      radius * 0.2,
      radius * 0.1
    );
    sceneRef.current.add(normalArrow);
    
    // Draw torch orientations at each point
    results.forEach((result, index) => {
      const position = new THREE.Vector3(result.position[0], result.position[1], result.position[2]);
      const torchDir = new THREE.Vector3(result.torchDirection[0], result.torchDirection[1], result.torchDirection[2]);
      const tangentDir = new THREE.Vector3(result.tangent[0], result.tangent[1], result.tangent[2]);
      
      // Position marker
      const markerGeometry = new THREE.SphereGeometry(0.05);
      const markerMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(position);
      sceneRef.current.add(marker);
      
      // Torch direction arrow (red)
      const torchArrow = new THREE.ArrowHelper(
        torchDir,
        position,
        radius * 0.4,
        0xff0000,
        radius * 0.1,
        radius * 0.05
      );
      sceneRef.current.add(torchArrow);
      
      // Tangent direction arrow (green)
      const tangentArrow = new THREE.ArrowHelper(
        tangentDir,
        position,
        radius * 0.3,
        0x00ff00,
        radius * 0.08,
        radius * 0.04
      );
      sceneRef.current.add(tangentArrow);
      
      // Point label
      const loader = new THREE.FontLoader();
      // We'll use a simple text sprite instead since font loading is complex
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 128;
      canvas.height = 64;
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'black';
      context.font = '20px Arial';
      context.fillText(`P${index}`, 10, 35);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position);
      sprite.position.add(new THREE.Vector3(0, 0, radius * 0.2));
      sprite.scale.set(radius * 0.3, radius * 0.15, 1);
      sceneRef.current.add(sprite);
    });
  };

  useEffect(() => {
    if (!mountRef.current) return;
    
    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(800, 600);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);
    
    // Add orbit controls (simplified mouse interaction)
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    
    const onMouseDown = (event) => {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };
    
    const onMouseUp = () => {
      mouseDown = false;
    };
    
    const onMouseMove = (event) => {
      if (!mouseDown) return;
      
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position);
      spherical.theta -= deltaX * 0.01;
      spherical.phi += deltaY * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
      
      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 0, 0);
      
      mouseX = event.clientX;
      mouseY = event.clientY;
    };
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();
    
    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Quaternion-based Torch Orientation Calculator</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Parameter Controls */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Trajectory Parameters</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Center Point</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={parameters.centerX}
                  onChange={(e) => setParameters({...parameters, centerX: parseFloat(e.target.value) || 0})}
                  className="border rounded px-2 py-1 text-sm"
                  placeholder="X"
                />
                <input
                  type="number"
                  step="0.1"
                  value={parameters.centerY}
                  onChange={(e) => setParameters({...parameters, centerY: parseFloat(e.target.value) || 0})}
                  className="border rounded px-2 py-1 text-sm"
                  placeholder="Y"
                />
                <input
                  type="number"
                  step="0.1"
                  value={parameters.centerZ}
                  onChange={(e) => setParameters({...parameters, centerZ: parseFloat(e.target.value) || 0})}
                  className="border rounded px-2 py-1 text-sm"
                  placeholder="Z"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Normal Vector</label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={parameters.normalX}
                  onChange={(e) => setParameters({...parameters, normalX: parseFloat(e.target.value) || 0})}
                  className="border rounded px-2 py-1 text-sm"
                  placeholder="X"
                />
                <input
                  type="number"
                  step="0.1"
                  value={parameters.normalY}
                  onChange={(e) => setParameters({...parameters, normalY: parseFloat(e.target.value) || 0})}
                  className="border rounded px-2 py-1 text-sm"
                  placeholder="Y"
                />
                <input
                  type="number"
                  step="0.1"
                  value={parameters.normalZ}
                  onChange={(e) => setParameters({...parameters, normalZ: parseFloat(e.target.value) || 1})}
                  className="border rounded px-2 py-1 text-sm"
                  placeholder="Z"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Radius</label>
              <input
                type="number"
                step="0.1"
                value={parameters.radius}
                onChange={(e) => setParameters({...parameters, radius: parseFloat(e.target.value) || 1})}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Torch Angle (degrees)</label>
              <input
                type="number"
                step="1"
                value={parameters.torchAngle}
                onChange={(e) => setParameters({...parameters, torchAngle: parseFloat(e.target.value) || 30})}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Number of Points</label>
              <input
                type="number"
                min="3"
                max="20"
                value={parameters.numPoints}
                onChange={(e) => setParameters({...parameters, numPoints: parseInt(e.target.value) || 8})}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            
            <button
              onClick={handleCalculate}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Calculate Quaternions
            </button>
          </div>
        </div>
        
        {/* 3D Visualization */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">3D Visualization</h2>
          <div ref={mountRef} className="border rounded" />
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Legend:</strong></p>
            <p>🟢 Green Ring: Circular trajectory</p>
            <p>🔵 Blue Arrow: Normal vector</p>
            <p>🔴 Red Arrows: Torch directions</p>
            <p>🟢 Green Arrows: Tangent directions</p>
            <p>🔴 Red Spheres: Trajectory points</p>
            <p>Click and drag to rotate view</p>
          </div>
        </div>
      </div>
      
      {/* Results Table */}
      {results && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Calculation Results</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Point</th>
                  <th className="text-left p-2">Position [x, y, z]</th>
                  <th className="text-left p-2">Quaternion [w, x, y, z]</th>
                  <th className="text-left p-2">Angle from Normal (°)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">P{index}</td>
                    <td className="p-2 font-mono">
                      [{result.position.map(v => v.toFixed(3)).join(', ')}]
                    </td>
                    <td className="p-2 font-mono">
                      [{result.quaternion.map(v => v.toFixed(3)).join(', ')}]
                    </td>
                    <td className="p-2">{result.angleFromNormal.toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Validation Results */}
          <div className="mt-4 p-4 bg-green-100 rounded">
            <h3 className="font-semibold text-green-800 mb-2">Validation Results:</h3>
            <p className="text-green-700">
              ✅ Constant angle maintained: {results.length > 0 && results.every(r => Math.abs(r.angleFromNormal - results[0].angleFromNormal) < 0.1) ? 'Yes' : 'No'}
            </p>
            <p className="text-green-700">
              ✅ Average angle from normal: {results.length > 0 ? (results.reduce((sum, r) => sum + r.angleFromNormal, 0) / results.length).toFixed(1) : 0}°
            </p>
            <p className="text-green-700">
              ✅ Target angle: {parameters.torchAngle}°
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TorchQuaternionCalculator;