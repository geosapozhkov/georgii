#!/usr/bin/env python3
"""Local preview server. Serves the site and stores editable copy so a phone window can read it."""
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
COPY = ROOT / 'js' / 'course-copy.json'
PROJECT_COPY = ROOT / 'js' / 'project-copy.json'
PROJECTS = ROOT / 'js' / 'projects.json'
COURSES = ROOT / 'Courses'
COURSE_ID = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
GROUP_ID = re.compile(r'^\d{3}$')
PROJECT_NAME = re.compile(r"^[\w']{1,80}$", re.UNICODE)
CATEGORIES = {'mind', 'commerce', 'rnd'}
ASSET_DIR = re.compile(
    r"^(?:Courses/[A-Za-z0-9_-]{1,64}/\d{3}|projects/[\w']{1,80}/images|RND)$"
)
ASSET_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$')
ASSET_EXTS = {'png': 'png', 'jpg': 'jpg', 'jpeg': 'jpg', 'gif': 'gif', 'webp': 'webp', 'avif': 'avif'}
MAX_IMAGE_BYTES = 30 * 1024 * 1024


def read_json(path, fallback):
    if not path.exists():
        return fallback
    data = json.loads(path.read_text(encoding='utf-8') or 'null')
    return data if isinstance(data, type(fallback)) else fallback


def project_copy_data():
    data = read_json(PROJECT_COPY, {})
    if not isinstance(data, dict):
        data = {}
    descriptions = data.get('descriptions')
    added = data.get('added')
    removed = data.get('removed')
    if not isinstance(descriptions, dict):
        descriptions = {}
    if not isinstance(added, list):
        added = []
    if not isinstance(removed, list):
        removed = []
    removed = [name for name in removed if isinstance(name, str)]
    return {'descriptions': descriptions, 'added': added, 'removed': removed}


def existing_project_names():
    names = set()
    data = read_json(PROJECTS, {})
    if isinstance(data, dict):
        for project in data.get('projects') or []:
            if isinstance(project, dict) and isinstance(project.get('name'), str):
                names.add(project['name'])
    for project in project_copy_data()['added']:
        if isinstance(project, dict) and isinstance(project.get('name'), str):
            names.add(project['name'])
    return names


def image_kind(data):
    if len(data) < 12:
        return None
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if data.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if data.startswith((b'GIF87a', b'GIF89a')):
        return 'gif'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return 'webp'
    if data[4:8] == b'ftyp' and b'avif' in data[8:32]:
        return 'avif'
    return None


def asset_folder(dir_value):
    if not isinstance(dir_value, str) or not ASSET_DIR.match(dir_value) or '..' in dir_value:
        raise ValueError
    folder = (ROOT / dir_value).resolve()
    root = ROOT.resolve()
    if folder == root or root not in folder.parents:
        raise ValueError
    return folder


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split('?', 1)[0]
        if (
            path in ('/js/course-copy.json', '/js/project-copy.json', '/api/course-description', '/api/project', '/api/course-image', '/api/course-layout')
            or path.endswith('/layout.json')
        ):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def read_body(self, limit=20000):
        length = int(self.headers.get('Content-Length') or 0)
        if length > limit:
            return None
        return json.loads(self.rfile.read(length).decode('utf-8'))

    def read_raw(self, limit):
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > limit:
            return None
        data = self.rfile.read(length)
        if len(data) != length:
            return None
        return data

    def send_json(self, payload):
        raw = json.dumps(payload).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        path = self.path.split('?', 1)[0]
        if path == '/api/course-description':
            self.save_course_description()
            return
        if path == '/api/project':
            self.save_project()
            return
        if path == '/api/course-image':
            self.save_course_image()
            return
        if path == '/api/course-layout':
            self.save_course_layout()
            return
        self.send_error(404)

    def save_course_image(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            folder = asset_folder((query.get('dir') or [''])[0])
            name = (query.get('name') or [''])[0]
            if not isinstance(name, str) or not ASSET_NAME.match(name):
                raise ValueError
            ext = name.rsplit('.', 1)[-1].lower()
            if ext not in ASSET_EXTS:
                raise ValueError
            data = self.read_raw(MAX_IMAGE_BYTES)
            if data is None:
                self.send_error(413)
                return
            if image_kind(data) != ASSET_EXTS[ext]:
                raise ValueError
            folder.mkdir(parents=True, exist_ok=True)
            target = (folder / name).resolve()
            if ROOT.resolve() not in target.parents:
                raise ValueError
            target.write_bytes(data)
            src = f"{folder.relative_to(ROOT).as_posix()}/{name}"
        except (ValueError, OSError):
            self.send_error(400)
            return
        self.send_json({'ok': True, 'src': src})

    def save_course_layout(self):
        try:
            body = self.read_body(200000)
            if body is None:
                self.send_error(413)
                return
            folder = asset_folder(body.get('dir'))
            description = body.get('description') if isinstance(body.get('description'), str) else ''
            if len(description) > 8000:
                raise ValueError
            images = body.get('images')
            if not isinstance(images, list) or len(images) > 200:
                raise ValueError
            prefix = f"{folder.relative_to(ROOT).as_posix()}/"
            clean = []
            for item in images:
                if not isinstance(item, dict):
                    raise ValueError
                image_id = item.get('id')
                if not isinstance(image_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', image_id):
                    raise ValueError
                try:
                    x = float(item.get('x'))
                    y = float(item.get('y'))
                    w = float(item.get('w'))
                    h = float(item.get('h'))
                except (TypeError, ValueError):
                    raise ValueError
                if not all(map(lambda n: abs(n) < 100000, (x, y, w, h))) or w <= 0 or h <= 0:
                    raise ValueError
                piece = {'id': image_id, 'x': x, 'y': y, 'w': w, 'h': h}
                vimeo = item.get('vimeo') or ''
                src = item.get('src') or ''
                if vimeo:
                    if not isinstance(vimeo, str) or not re.fullmatch(r'\d{6,12}', vimeo):
                        raise ValueError
                    if not isinstance(src, str) or len(src) > 300:
                        raise ValueError
                    piece['vimeo'] = vimeo
                    piece['src'] = src
                    image_hash = item.get('hash') or ''
                    if image_hash:
                        if not isinstance(image_hash, str) or not re.fullmatch(r'[A-Za-z0-9]+', image_hash):
                            raise ValueError
                        piece['hash'] = image_hash
                else:
                    if not isinstance(src, str) or not src.startswith(prefix) or '..' in src:
                        raise ValueError
                    piece['src'] = src
                clean.append(piece)
            folder.mkdir(parents=True, exist_ok=True)
            payload = {'description': description, 'images': clean}
            (folder / 'layout.json').write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8'
            )
        except (ValueError, json.JSONDecodeError, UnicodeError, TypeError, OSError):
            self.send_error(400)
            return
        self.send_json({'ok': True})

    def save_course_description(self):
        try:
            body = self.read_body()
            if body is None:
                self.send_error(413)
                return
            course_id = body.get('courseId')
            group_id = body.get('groupId')
            description = body.get('description')
            if not isinstance(course_id, str) or not COURSE_ID.match(course_id):
                raise ValueError
            if not isinstance(group_id, str) or not GROUP_ID.match(group_id):
                raise ValueError
            if not isinstance(description, str) or len(description) > 8000:
                raise ValueError
            data = read_json(COPY, {})
            if not isinstance(data, dict):
                data = {}
            course = data.get(course_id)
            if not isinstance(course, dict):
                course = {}
            course[group_id] = description
            data[course_id] = course
            COPY.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        except (ValueError, json.JSONDecodeError, UnicodeError, TypeError):
            self.send_error(400)
            return
        self.send_json({'ok': True})

    def save_project(self):
        try:
            body = self.read_body()
            if body is None:
                self.send_error(413)
                return
            action = body.get('action')
            name = body.get('name')
            category = body.get('category')
            if not isinstance(name, str) or not PROJECT_NAME.match(name):
                raise ValueError
            if not isinstance(category, str) or category.lower() not in CATEGORIES:
                raise ValueError
            category = category.lower()
            data = project_copy_data()
            if action == 'add':
                title = body.get('title')
                description = body.get('description') if isinstance(body.get('description'), str) else ''
                if not isinstance(title, str) or not title.strip() or len(title) > 120:
                    raise ValueError
                if len(description) > 8000:
                    raise ValueError
                data['removed'] = [item for item in data['removed'] if item != name]
                if name not in existing_project_names():
                    data['added'].append({
                        'name': name,
                        'title': title.strip(),
                        'category': category,
                        'description': description
                    })
            elif action == 'remove':
                data['added'] = [
                    project for project in data['added']
                    if not (isinstance(project, dict) and project.get('name') == name)
                ]
                if name not in data['removed']:
                    data['removed'].append(name)
            elif action == 'description':
                description = body.get('description')
                if not isinstance(description, str) or len(description) > 8000:
                    raise ValueError
                data['descriptions'][f'{category}:{name}'] = description
                for project in data['added']:
                    if isinstance(project, dict) and project.get('name') == name:
                        project['description'] = description
            else:
                raise ValueError
            PROJECT_COPY.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        except (ValueError, json.JSONDecodeError, UnicodeError, TypeError):
            self.send_error(400)
            return
        self.send_json({'ok': True, 'copy': project_copy_data()})


if __name__ == '__main__':
    os.chdir(ROOT)
    ThreadingHTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
