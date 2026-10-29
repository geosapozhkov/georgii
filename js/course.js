const courseRoot = document.getElementById('course-root');

function groupLabel(index) {
  return String(index).padStart(3, '0');
}

function groupOpacity(index, count) {
  if (count <= 1) return 1;
  const t = index / (count - 1);
  return Math.max(0.05, Math.pow(1 - t, 1.85));
}

function renderGroups(course) {
  document.title = course.title;
  courseRoot.className = 'course-groups';

  const title = document.createElement('div');
  title.className = 'course-groups-title';
  title.textContent = course.title;

  const column = document.createElement('div');
  column.className = 'course-group-col';
  const count = course.groupCount;

  for (let index = 0; index < count; index += 1) {
    const id = groupLabel(index);
    const page = course.groups && course.groups[id];
    const item = document.createElement(page ? 'a' : 'span');
    item.className = 'course-group-id';
    item.textContent = id;
    item.style.setProperty('--fade', groupOpacity(index, count).toFixed(3));
    if (page) {
      item.href = `course.html?course=${encodeURIComponent(course.id)}&group=${id}`;
    }
    column.appendChild(item);
  }

  courseRoot.append(title, column);
}

function renderDetail(course, groupId, group) {
  document.title = `${course.title} ${groupId}`;
  courseRoot.className = 'course-detail';

  const title = document.createElement('div');
  title.className = 'course-detail-title';

  const courseLink = document.createElement('a');
  courseLink.href = `course.html?course=${encodeURIComponent(course.id)}`;
  courseLink.textContent = course.title;

  const number = document.createElement('span');
  number.textContent = groupId;
  title.append(courseLink, number);

  const body = document.createElement('div');
  body.className = 'course-detail-body';

  const authors = document.createElement('div');
  authors.className = 'course-authors';
  const label = document.createElement('div');
  label.textContent = group.authorsLabel || 'Authors';
  authors.appendChild(label);
  (group.authors || []).forEach((name) => {
    const line = document.createElement('div');
    line.textContent = name;
    authors.appendChild(line);
  });
  body.appendChild(authors);

  if (group.description) {
    const description = document.createElement('p');
    description.className = 'course-description';
    description.textContent = group.description;
    body.appendChild(description);
  }

  const works = document.createElement('div');
  works.id = 'course-works';
  works.hidden = true;
  body.appendChild(works);

  courseRoot.append(title, body);
}

async function initCoursePage() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('course');
  const groupId = params.get('group');

  let courses = {};
  try {
    const response = await fetch('js/courses.json');
    courses = await response.json();
  } catch (_) {
    courses = {};
  }

  const course = courseId ? courses[courseId] : null;
  if (!course) {
    window.location.replace('index.html');
    return;
  }

  const group = groupId && course.groups ? course.groups[groupId] : null;
  if (group) {
    renderDetail(course, groupId, group);
    return;
  }

  renderGroups(course);
}

initCoursePage();
