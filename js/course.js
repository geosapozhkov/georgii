const courseRoot = document.getElementById('course-root');

function groupLabel(index) {
  return String(index).padStart(3, '0');
}

let pinResize = null;

function pinLeftToCourses(block, anchor) {
  const place = () => {
    const width = anchor.getBoundingClientRect().width;
    block.style.marginLeft = `calc(50% - ${width / 2}px)`;
  };
  if (pinResize) window.removeEventListener('resize', pinResize);
  pinResize = place;
  window.addEventListener('resize', place);
  requestAnimationFrame(place);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(place);
  }
}

function renderGroups(course) {
  document.title = course.title;
  courseRoot.className = 'course-anchor';

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
    if (page) {
      item.href = `course.html?course=${encodeURIComponent(course.id)}&group=${id}`;
    }
    column.appendChild(item);
  }

  courseRoot.append(title, column);
  pinLeftToCourses(courseRoot, title);
}

function renderDetail(course, groupId, group) {
  document.title = `${course.title} ${groupId}`;
  courseRoot.className = 'course-anchor';

  const nameCol = document.createElement('div');
  nameCol.className = 'course-name-col';

  const courseLink = document.createElement('a');
  courseLink.className = 'course-name';
  courseLink.href = `course.html?course=${encodeURIComponent(course.id)}`;
  courseLink.textContent = course.title;

  const number = document.createElement('span');
  number.className = 'course-side-number';
  number.textContent = groupId;

  const body = document.createElement('div');
  body.className = 'course-detail-body';

  const authors = document.createElement('div');
  authors.className = 'course-authors description-text';
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

  nameCol.append(courseLink, body);
  courseRoot.append(nameCol, number);
  pinLeftToCourses(courseRoot, courseLink);
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
