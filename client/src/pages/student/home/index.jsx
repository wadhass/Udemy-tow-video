import { courseCategories } from "@/config";
import banner from "../../../../public/banner-img.png";
import { Button } from "@/components/ui/button";
import { useContext, useEffect } from "react";
import { StudentContext } from "@/context/student-context";
import {
  checkCoursePurchaseInfoService,
  fetchStudentViewCourseListService,
} from "@/services";
import { AuthContext } from "@/context/auth-context";
import { useNavigate } from "react-router-dom";

function StudentHomePage() {
  const { studentViewCoursesList, setStudentViewCoursesList } =
    useContext(StudentContext);
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();

  function handleNavigateToCoursesPage(getCurrentId) {
    sessionStorage.removeItem("filters");
    const currentFilter = {
      category: [getCurrentId],
    };

    sessionStorage.setItem("filters", JSON.stringify(currentFilter));

    navigate("/courses");
  }

  async function handleCourseNavigate(getCurrentCourseId) {
    if (!auth?.user?._id) {
      navigate(`/course/details/${getCurrentCourseId}`);
      return;
    }

    const response = await checkCoursePurchaseInfoService(getCurrentCourseId);

    if (response?.success) {
      if (response?.data) {
        navigate(`/course-progress/${getCurrentCourseId}`);
      } else {
        navigate(`/course/details/${getCurrentCourseId}`);
      }
    }
  }

  useEffect(() => {
    async function fetchAllStudentViewCourses() {
      const response = await fetchStudentViewCourseListService();
      if (response?.success) setStudentViewCoursesList(response?.data);
    }

    fetchAllStudentViewCourses();
  }, [setStudentViewCoursesList]);

  return (
    <div className="min-h-screen bg-white">
      <section className="flex flex-col lg:flex-row items-center justify-between gap-8 bg-slate-950 px-4 py-14 text-white lg:px-8">
        <div className="lg:w-1/2 lg:pr-12">
          <p className="mb-3 font-semibold uppercase tracking-[0.2em] text-indigo-300">
            Learn something new
          </p>
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">
            Skills for the future, built one course at a time.
          </h1>
          <p className="mb-6 text-xl text-slate-300">
            Explore practical lessons in programming, web development, and more.
          </p>
          <Button onClick={() => navigate("/courses")}>Explore all courses</Button>
        </div>
        <div className="w-full lg:w-1/2">
          <img
            src={banner}
            alt="Explore online courses"
            width={600}
            height={400}
            className="h-auto w-full rounded-lg shadow-lg"
          />
        </div>
      </section>
      <section className="bg-gray-100 px-4 py-8 lg:px-8">
        <h2 className="mb-2 text-2xl font-bold">Explore by topic</h2>
        <p className="mb-6 text-gray-600">
          Find a starting point in the languages and tools you want to learn.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {courseCategories.map((categoryItem) => (
            <Button
              className="justify-start"
              variant="outline"
              key={categoryItem.id}
              onClick={() => handleNavigateToCoursesPage(categoryItem.id)}
            >
              {categoryItem.label}
            </Button>
          ))}
        </div>
      </section>
      <section className="px-4 py-12 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Featured courses</h2>
            <p className="mt-1 text-gray-600">
              Learn the fundamentals and start building your next project.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/courses")}>
            View all courses
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {studentViewCoursesList && studentViewCoursesList.length > 0 ? (
            studentViewCoursesList.map((courseItem) => (
              <div
                key={courseItem?._id}
                onClick={() => handleCourseNavigate(courseItem?._id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleCourseNavigate(courseItem?._id);
                  }
                }}
                role="button"
                tabIndex={0}
                className="cursor-pointer overflow-hidden rounded-lg border shadow transition-shadow hover:shadow-lg"
              >
                <img
                  src={courseItem?.image}
                  alt={courseItem?.title || "Course"}
                  width={300}
                  height={150}
                  className="w-full h-40 object-cover"
                />
                <div className="p-4">
                  <h3 className="font-bold mb-2">{courseItem?.title}</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    {courseItem?.instructorName}
                  </p>
                  <p className="font-bold text-[16px]">
                    ${courseItem?.pricing}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    {courseItem?.curriculum?.length || 0} lessons
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-600">
              No courses are available yet. Check back soon.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default StudentHomePage;
