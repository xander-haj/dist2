export function createTeacherStudentDiagram(id) {
  const container = document.getElementById(id);
  if (!container) return;


  const svg = `
  <svg width="100%" height="200" viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    <!-- Teacher -->
    <rect x="50" y="50" width="120" height="100" rx="10" fill="#4f46e5" opacity="0.8" />
    <text x="110" y="105" font-family="sans-serif" font-size="16" fill="white" text-anchor="middle">Teacher (70B)</text>
    
    <!-- Student -->
    <rect x="430" y="75" width="100" height="50" rx="10" fill="#818cf8" opacity="0.9" />
    <text x="480" y="105" font-family="sans-serif" font-size="14" fill="white" text-anchor="middle">Student (7B)</text>

    <!-- Arrow -->
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
      </marker>
    </defs>
    <line x1="170" y1="100" x2="420" y2="100" stroke="#94a3b8" stroke-width="2" marker-end="url(#arrow)" />
    
    <!-- Data -->
    <text x="300" y="90" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle">Soft Labels (Logits)</text>
    <text x="300" y="120" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle">Synthetic Data</text>
  </svg>
  `;
  container.innerHTML = svg;
}
