#!/usr/bin/env python3
"""Local preview server. Serves the site and stores editable copy so a phone window can read it."""
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COPY = ROOT / 'js' / 'course-copy.json'
PROJECT_COPY = ROOT / 'js' / 'project-copy.json'
PROJECTS = ROOT / 'js' / 'projects.json'
COURSE_ID = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
GROUP_ID = re.compile(r'^\d{3}$')
PROJECT_NAME = re.compile(r"^[\w']{1,80}$", re.UNICODE)
CATEGORIES = {'mind', 'commerce', 'rnd'}


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


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split('?', 1)[0]
        if path in ('/js/course-copy.json', '/js/project-copy.json', '/api/course-description', '/api/project'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def read_body(self):
        length = int(self.headers.get('Content-Length') or 0)
        if length > 20000:
            return None
        return json.loads(self.rfile.read(length).decode('utf-8'))

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
        self.send_error(404)

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
