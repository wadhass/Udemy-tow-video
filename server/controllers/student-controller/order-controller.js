const paypal = require("../../helpers/paypal");
const mongoose = require("mongoose");
const Order = require("../../models/Order");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");

async function enrollStudentInCourse({
  userId,
  userName,
  userEmail,
  courseId,
  courseTitle,
  instructorId,
  instructorName,
  courseImage,
  coursePricing,
  dateOfPurchase,
}) {
  await StudentCourses.updateOne(
    { userId },
    {
      $setOnInsert: { userId },
      $addToSet: {
        courses: {
          courseId,
          title: courseTitle,
          instructorId,
          instructorName,
          dateOfPurchase,
          courseImage,
        },
      },
    },
    { upsert: true }
  );

  await Course.updateOne(
    { _id: courseId },
    {
      $addToSet: {
        students: {
          studentId: userId,
          studentName: userName,
          studentEmail: userEmail,
          paidAmount: String(coursePricing),
        },
      },
    }
  );
}

const createOrder = async (req, res) => {
  try {
    const { courseId } = req.body || {};
    const userId = String(req.user._id);

    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({
        success: false,
        message: "A valid course is required",
      });
    }

    const course = await Course.findById(courseId);
    if (!course || !course.isPublised) {
      return res.status(404).json({
        success: false,
        message: "Published course not found",
      });
    }

    if (String(course.instructorId) === userId) {
      return res.status(403).json({
        success: false,
        message: "Instructors cannot purchase their own course",
      });
    }

    const studentCourses = await StudentCourses.findOne({ userId });
    if (studentCourses?.courses?.some((item) => item.courseId === courseId)) {
      return res.status(409).json({
        success: false,
        message: "You already own this course",
      });
    }

    const coursePricing = Number(course.pricing);
    if (!Number.isFinite(coursePricing) || coursePricing < 0) {
      return res.status(400).json({
        success: false,
        message: "Course price is invalid",
      });
    }

    const orderDate = new Date();
    const user = req.user;

    if (coursePricing === 0) {
      await enrollStudentInCourse({
        userId,
        userName: user.userName,
        userEmail: user.userEmail,
        courseId,
        courseTitle: course.title,
        instructorId: course.instructorId,
        instructorName: course.instructorName,
        courseImage: course.image,
        coursePricing,
        dateOfPurchase: orderDate,
      });

      return res.status(201).json({
        success: true,
        data: { freeCourse: true, courseId },
      });
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    const create_payment_json = {
      intent: "sale",
      payer: {
        payment_method: "paypal",
      },
      redirect_urls: {
        return_url: `${clientUrl}/payment-return`,
        cancel_url: `${clientUrl}/course/details/${courseId}?payment=cancelled`,
      },
      transactions: [
        {
          item_list: {
            items: [
              {
                name: course.title,
                sku: courseId,
                price: coursePricing.toFixed(2),
                currency: "USD",
                quantity: 1,
              },
            ],
          },
          amount: {
            currency: "USD",
            total: coursePricing.toFixed(2),
          },
          description: course.title,
        },
      ],
    };

    paypal.payment.create(create_payment_json, async (error, paymentInfo) => {
      if (error) {
        console.log(error);
        return res.status(500).json({
          success: false,
          message: "Error while creating paypal payment!",
        });
      } else {
        try {
          const approveUrl = paymentInfo.links.find(
            (link) => link.rel === "approval_url"
          )?.href;

          if (!approveUrl || !paymentInfo.id) {
            return res.status(502).json({
              success: false,
              message: "PayPal did not return an approval link",
            });
          }

          const newlyCreatedCourseOrder = new Order({
            userId,
            userName: user.userName,
            userEmail: user.userEmail,
            orderStatus: "pending",
            paymentMethod: "paypal",
            paymentStatus: "initiated",
            orderDate,
            paymentId: paymentInfo.id,
            payerId: "",
            instructorId: course.instructorId,
            instructorName: course.instructorName,
            courseImage: course.image,
            courseTitle: course.title,
            courseId,
            coursePricing,
          });

          await newlyCreatedCourseOrder.save();

          res.status(201).json({
            success: true,
            data: {
              approveUrl,
              orderId: newlyCreatedCourseOrder._id,
            },
          });
        } catch (saveError) {
          console.log(saveError);
          res.status(500).json({
            success: false,
            message: "Could not save the order",
          });
        }
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const capturePaymentAndFinalizeOrder = async (req, res) => {
  try {
    const { paymentId, payerId, orderId } = req.body;

    if (!mongoose.isValidObjectId(orderId) || !paymentId || !payerId) {
      return res.status(400).json({
        success: false,
        message: "Payment details are incomplete",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      userId: String(req.user._id),
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order cannot be found",
      });
    }

    if (order.paymentStatus === "paid" && order.paymentId === paymentId) {
      await enrollStudentInCourse({
        userId: order.userId,
        userName: order.userName,
        userEmail: order.userEmail,
        courseId: order.courseId,
        courseTitle: order.courseTitle,
        instructorId: order.instructorId,
        instructorName: order.instructorName,
        courseImage: order.courseImage,
        coursePricing: order.coursePricing,
        dateOfPurchase: order.orderDate,
      });

      return res.status(200).json({
        success: true,
        message: "Order already confirmed",
        data: order,
      });
    }

    if (order.paymentStatus !== "initiated" || order.paymentId !== paymentId) {
      return res.status(409).json({
        success: false,
        message: "This order cannot be captured",
      });
    }

    paypal.payment.execute(
      paymentId,
      { payer_id: payerId },
      async (error, paymentInfo) => {
        if (error) {
          console.log(error);
          return res.status(400).json({
            success: false,
            message: "PayPal could not confirm this payment",
          });
        }

        try {
          const transaction = paymentInfo?.transactions?.[0];
          const payerMatches =
            paymentInfo?.payer?.payer_info?.payer_id === payerId;
          const amountMatches =
            transaction?.amount?.currency === "USD" &&
            Number(transaction.amount.total).toFixed(2) ===
              Number(order.coursePricing).toFixed(2);
          const courseMatches = transaction?.item_list?.items?.some(
            (item) =>
              item.sku === order.courseId &&
              Number(item.price).toFixed(2) ===
                Number(order.coursePricing).toFixed(2)
          );

          if (
            paymentInfo?.state !== "approved" ||
            !payerMatches ||
            !amountMatches ||
            !courseMatches
          ) {
            return res.status(400).json({
              success: false,
              message: "PayPal payment details do not match this order",
            });
          }

          order.paymentStatus = "paid";
          order.orderStatus = "confirmed";
          order.payerId = payerId;
          await order.save();

          await enrollStudentInCourse({
            userId: order.userId,
            userName: order.userName,
            userEmail: order.userEmail,
            courseId: order.courseId,
            courseTitle: order.courseTitle,
            instructorId: order.instructorId,
            instructorName: order.instructorName,
            courseImage: order.courseImage,
            coursePricing: order.coursePricing,
            dateOfPurchase: order.orderDate,
          });

          return res.status(200).json({
            success: true,
            message: "Order confirmed",
            data: order,
          });
        } catch (finalizeError) {
          console.log(finalizeError);
          return res.status(500).json({
            success: false,
            message: "Payment was confirmed but enrollment could not finish",
          });
        }
      }
    );
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

module.exports = { createOrder, capturePaymentAndFinalizeOrder };
