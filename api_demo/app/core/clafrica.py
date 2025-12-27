from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Dict


def load_clafrica_map(project_dir: Path) -> Dict[str, str]:
	map_path = project_dir / "clafrica_map.py"
	if not map_path.exists():
		return {}

	spec = spec_from_file_location("clafrica_map", map_path)
	if spec is None or spec.loader is None:
		return {}

	module = module_from_spec(spec)
	spec.loader.exec_module(module)
	mapping = getattr(module, "Clafrica", {})
	if not isinstance(mapping, dict):
		return {}
	return mapping
