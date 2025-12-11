#!/usr/bin/env bash
# Export Markdown docs in /docs to a single Word report via Pandoc.
# Usage:  bash export-docs.sh
# Requires: pandoc in PATH (https://pandoc.org/installing.html)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

build_dir="$SCRIPT_DIR/build"
docs_dir="$SCRIPT_DIR/docs"
order_file="$docs_dir/_order.txt"
metadata_file="$docs_dir/metadata.yaml"
reference_doc="$docs_dir/reference.docx"
out_file="$build_dir/Report.docx"

mkdir -p "$build_dir"

if ! command -v pandoc >/dev/null 2>&1; then
  echo "Pandoc not found in PATH. Install from https://pandoc.org/"
  exit 1
fi

declare -a files
if [[ -f "$order_file" ]]; then
  echo "Using explicit order from docs/_order.txt"
  while IFS= read -r line; do
    line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    full="$docs_dir/$line"
    if [[ -f "$full" ]]; then
      files+=("$full")
    else
      echo "WARNING: Missing file listed in _order.txt: $line" >&2
    fi
  done < "$order_file"
else
  echo "Using alphabetical order of docs/*.md"
  while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$docs_dir" -maxdepth 1 -type f -name '*.md' -print0 | sort -z)
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No markdown files found in /docs. Add .md files or an _order.txt."
  exit 1
fi

args=( )
[[ -f "$metadata_file" ]] && args+=( "--metadata-file=$metadata_file" )
args+=( "--toc" "--toc-depth=2" )
args+=( "--resource-path=.:docs" )
[[ -f "$reference_doc" ]] && args+=( "--reference-doc=$reference_doc" )
args+=( "-s" "-o" "$out_file" )

# --- Add current compile date dynamically, ain't nobody got time to manually change this ---
compile_date=$(date '+%Y-%m-%d')
args+=( "--metadata" "date=$compile_date" )

echo "Running Pandoc..."
echo pandoc "${files[@]}" "${args[@]}"
pandoc "${files[@]}" "${args[@]}"

echo "Done. Output: $out_file"
