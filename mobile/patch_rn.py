import os
import re

def patch_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except Exception:
        return
    
    # We replace '#' followed by a word character with '_' followed by the word character
    # But only if it's not a hex color. React Native `#private` fields are usually `#name`, `#registry`, etc.
    # Hex colors are usually 3, 4, 6, or 8 hex digits, usually at the end of a string or CSS rule.
    # We can use a regex that matches # followed by a letter (since private fields almost always start with a letter)
    # Hex colors can start with a letter (e.g. #fff, #cccccc, #ff0000), so we might accidentally replace them.
    # Is it a big deal if we replace hex colors in JS files? No, mostly they are strings, but replacing them might mess up styling.
    # To be safe, let's only replace `#` if it's preceded by `.` (e.g. `this.#name`) or it's preceded by whitespace (e.g. `  #name;`).
    # Regex: `(?<=\s|\.)#([a-zA-Z_]\w*)`
    
    new_content = re.sub(r'(?<=\s|\.)#([a-zA-Z_]\w*)', r'_\1', content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Patched {filepath}")

def walk_and_patch(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.js'):
                patch_file(os.path.join(root, file))

if __name__ == '__main__':
    target_dir = '/Users/sinchanavs/minii/mobile/node_modules/react-native'
    walk_and_patch(target_dir)
    print("Done patching all of React Native!")
