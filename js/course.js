const courseRoot = document.getElementById('course-root');

function groupLabel(index) {
  return String(index).padStart(3, '0');
}

let pinResize = null;

function pinLeftToCourses(block) {
  const place = () => {
    if (window.innerWidth >= 640) {
      block.style.marginLeft = 'calc(40vw + 226px)';
      return;
    }
    block.style.marginLeft = 'var(--mobile-edge)';
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
  pinLeftToCourses(courseRoot);
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

  const works = document.createElement('div');
  works.id = 'course-works';
  works.hidden = true;
  body.appendChild(works);

  nameCol.append(courseLink, body);
  courseRoot.append(nameCol, number);
  pinLeftToCourses(courseRoot);
}

function parseCourseRequest() {
  const params = new URLSearchParams(window.location.search);
  let courseId = params.get('course') || '';
  let groupId = params.get('group') || '';
  let admin = params.has('admin') || /admin$/i.test(window.location.href.split('#')[0]);
  if (/admin$/i.test(courseId)) {
    admin = true;
    courseId = courseId.replace(/admin$/i, '');
  }
  if (/admin$/i.test(groupId)) {
    admin = true;
    groupId = groupId.replace(/admin$/i, '');
  }
  return { courseId, groupId, admin };
}

async function initCoursePage() {
  const { courseId, groupId, admin } = parseCourseRequest();

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
    if (window.loadPublishedCopy) await window.loadPublishedCopy();
    renderDetail(course, groupId, group);
    const session = {
      courseId: course.id,
      groupId,
      descriptionFallback: group.description || ''
    };
    if (admin) {
      window.__courseAdminPending = session;
      if (window.startCourseAdmin) window.startCourseAdmin(session);
      else if (window.showSavedCourseLayout) window.showSavedCourseLayout(session);
    } else {
      window.__courseLayoutPending = session;
      if (window.showSavedCourseLayout) window.showSavedCourseLayout(session);
    }
    return;
  }

  renderGroups(course);
}

initCoursePage();
