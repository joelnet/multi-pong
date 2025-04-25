/**
 * Gets an element by ID with type checking
 * @template T
 * @param {string} id - The ID of the element to get
 * @returns {T} - The element with the specified type
 */
export function $(id) {
  return /** @type {T} */ (document.getElementById(id));
}

/**
 * Gets elements by selector with type checking
 * @param {string} selector - The CSS selector to query
 * @returns {NodeListOf<Element>} - The elements matching the selector
 */
export function $$(selector) {
  return /** @type {NodeListOf<Element>} */ (document.querySelectorAll(selector));
}

/**
 * Shows a specific scene and hides all others
 * @param {string} sceneId - The ID of the scene to show
 */
export function showScene(sceneId) {
  // Get all scenes
  const scenes = $$('.screen');

  // Hide all scenes
  scenes.forEach(scene => {
    scene.classList.add('hidden');
  });

  // Show the requested scene
  const sceneToShow = $(sceneId);
  if (sceneToShow) {
    sceneToShow.classList.remove('hidden');
  } else {
    console.error(`Scene with ID "${sceneId}" not found`);
  }
}
