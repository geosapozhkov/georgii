#!/usr/bin/env python3
"""Local preview server. Serves the site and stores course descriptions so a phone window can read them."""
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COPY = ROOT / 'js' / 'course-copy.json'
COURSE_ID = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
GROUP_ID = re.compile(r'^\d{3}$')


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split('?', 1)[0]
        if path == '/js/course-copy.json' or path == '/api/course-description':
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path.split('?', 1)[0] != '/api/course-description':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length') or 0)
        if length > 20000:
            self.send_error(413)
            return
        try:
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            course_id = body.get('courseId')
            group_id = body.get('groupId')
            description = body.get('description')
            if not isinstance(course_id, str) or not COURSE_ID.match(course_id):
                raise ValueError
            if not isinstance(group_id, str) or not GROUP_ID.match(group_id):
                raise ValueError
            if not isinstance(description, str) or len(description) > 8000:
                raise ValueError
            data = {}
            if COPY.exists():
                data = json.loads(COPY.read_text(encoding='utf-8') or '{}')
            if not isinstance(data, dict):
                data = {}
            course = data.get(course_id)
            if not isinstance(course, dict):
                course = {}
            course[group_id] = description
            data[course_id] = course
            COPY.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        except (ValueError, json.JSONDecodeError, UnicodeError):
            self.send_error(400)
            return
        payload = b'{"ok":true}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == '__main__':
    os.chdir(ROOT)
    ThreadingHTTPServer(('0.0.0.0', 8000), Handler).serve_forever()
