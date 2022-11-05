import React, { useCallback, useEffect, useRef } from "react";

export const Canvas = (props) => {
  const canvasRef = useRef(null);
  const endPointX = useRef(0);
  const endPointY = useRef(0);
  const startPointX = useRef(0);
  const startPointY = useRef(0);
  const isDrawing = useRef(false);
  const lines = useRef([]);
  const circles = useRef([]);
  const temporaryCircles = useRef([]);
  const isAnimating = useRef(false);

  const getMousePosition = useCallback((event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x:
        ((event.clientX - rect.left) / (rect.right - rect.left)) * canvas.width,
      y:
        ((event.clientY - rect.top) / (rect.bottom - rect.top)) * canvas.height,
    };
  }, []);

  const drawLine = useCallback((context, from, to) => {
    context.beginPath();
    context.lineWidth = 1;
    context.strokeStyle = "black";
    context.moveTo(from[0], from[1]);
    context.lineTo(to[0], to[1]);
    context.stroke();
  }, []);

  const drawCircles = useCallback((context, circles) => {
    circles.forEach(([x, y]) => {
      context.beginPath();
      context.arc(x, y, 5, 0, 2 * Math.PI);

      context.fillStyle = "red";
      context.fill();

      context.strokeStyle = "black";
      context.stroke();

      context.closePath();
    });
  }, []);

  const drawIntersection = useCallback(
    (context) => {
      temporaryCircles.current = [];
      lines.current.forEach(([from, to]) => {
        const intersection = intersects(
          [startPointX.current, startPointY.current],
          [endPointX.current, endPointY.current],
          from,
          to
        );
        if (intersection) {
          temporaryCircles.current.push(intersection);
        }
      });
      //   console.log(circles.current);
      drawCircles(context, temporaryCircles.current);
    },
    [startPointX, startPointY, endPointX, endPointY, circles]
  );
  const intersects = useCallback((from1, to1, from2, to2) => {
    // console.log("HEEELOOO", from1, to1, from2, to2);
    const det =
      (to1[0] - from1[0]) * (to2[1] - from2[1]) -
      (to1[1] - from1[1]) * (to2[0] - from2[0]);
    if (det === 0) return false;
    const lambda =
      ((to2[1] - from2[1]) * (to2[0] - from1[0]) +
        (from2[0] - to2[0]) * (to2[1] - from1[1])) /
      det;
    const gamma =
      ((from1[1] - to1[1]) * (to2[0] - from1[0]) +
        (to1[0] - from1[0]) * (to2[1] - from1[1])) /
      det;

    if (!(0 <= lambda && lambda <= 1) || !(0 <= gamma && gamma <= 1)) {
      return false;
    }

    return [
      from1[0] + lambda * (to1[0] - from1[0]),
      from1[1] + lambda * (to1[1] - from1[1]),
    ];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (isAnimating.current) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    lines.current.forEach(([from, to]) => {
      drawLine(context, from, to);
    });
    drawCircles(context, circles.current);
    // console.log("FROM DRAW", endPointX.current, endPointY.current);
    if (!isDrawing.current) return;

    drawLine(
      context,
      [startPointX.current, startPointY.current],
      [endPointX.current, endPointY.current]
    );
    drawIntersection(context);
  }, [drawLine, drawIntersection, drawCircles]);

  const getLinesForAnimation = (lines) => {
    const linesForAnimation = [];
    lines.current.forEach(([from, to]) => {
      linesForAnimation.push(
        [
          { x: from[0], y: from[1] },
          { x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2 },
        ],
        [
          { x: to[0], y: to[1] },
          { x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2 },
        ]
      );
    });
    return linesForAnimation;
  };

  //isAnimating
  const getVectorFromTwoPoints = (point1, point2) => {
    return {
      x: point2.x - point1.x,
      y: point2.y - point1.y,
    };
  };
  const getDistanceBetweenPoints = (point1, point2) => {
    const x = point1.x - point2.x;
    const y = point1.y - point2.y;

    return Math.sqrt(x * x + y * y);
  };
  const FRAME_DURATION = 1000 / 60; // 60fps frame duration ~16.66ms
  const getTime =
    typeof performance === "function" ? performance.now : Date.now;

  // Global requestAnimationFrame ID so we can cancel it when user clicks on "Draw again"
  let rafID;
  const drawLineAnimation = (
    startPoint,
    endPoint,
    drawingSpeed = 0.4,
    onAnimationEnd,
    startingLength = 0
  ) => {
    let lastUpdate = getTime();

    // Set initial state
    let currentPoint = startPoint;
    const vector = getVectorFromTwoPoints(startPoint, endPoint);
    const startToEndDistance = getDistanceBetweenPoints(startPoint, endPoint);

    const lineStep = 0.01;

    const vectorStep = {
      x: vector.x * lineStep,
      y: vector.y * lineStep,
    };

    const animate = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const now = getTime();
      const delta = (now - lastUpdate) / FRAME_DURATION;

      const deltaVector = {
        x: vectorStep.x * delta,
        y: vectorStep.y * delta,
      };

      // Add starting length if any
      if (startingLength) {
        const startingLengthFactor = startingLength / startToEndDistance;

        deltaVector.x += vector.x * startingLengthFactor;
        deltaVector.y += vector.y * startingLengthFactor;

        // We've drawn it once, we don't want to draw it again
        startingLength = 0;
      }

      // Set next point
      let nextPoint = {
        x: currentPoint.x + deltaVector.x,
        y: currentPoint.y + deltaVector.y,
      };

      let newStartingLength = 0;
      let isFinished = false;

      const startToNextPointDistance = getDistanceBetweenPoints(
        startPoint,
        nextPoint
      );

      // The next point is past the end point
      if (startToNextPointDistance >= startToEndDistance) {
        newStartingLength = startToNextPointDistance - startToEndDistance;
        isFinished = true;
        nextPoint = endPoint;
      }

      // Draw line segment
      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.lineCap = "round";
      ctx.lineWidth = 11;
      ctx.moveTo(currentPoint.x, currentPoint.y);
      ctx.lineTo(nextPoint.x, nextPoint.y);
      ctx.stroke();

      if (isFinished) {
        if (onAnimationEnd) {
          onAnimationEnd(newStartingLength);
        }
        return;
      }

      // Move current point to the end of the drawn segment
      currentPoint = nextPoint;

      // Update last updated time
      lastUpdate = now;

      // Store requestAnimationFrame ID so we can cancel it
      rafID = requestAnimationFrame(animate);
    };

    // Start isAnimating
    animate();
  };
  const drawPolygon = (
    vertices,
    drawingSpeed = 5,
    onAnimationEnd,
    startingLength = 0,
    startingPointIndex = 0
  ) => {
    const start = vertices[startingPointIndex];
    const end = vertices[startingPointIndex + 1];

    if (startingPointIndex + 1 >= vertices.length) {
      if (onAnimationEnd) {
        onAnimationEnd();
      }
      return;
    }

    drawLineAnimation(
      start,
      end,
      drawingSpeed,
      (startingLength) => {
        const newIndex = startingPointIndex + 1;

        drawPolygon(
          vertices,
          drawingSpeed,
          onAnimationEnd,
          startingLength,
          newIndex
        );
      },
      startingLength
    );
  };
  const collapseLines = () => {
    // console.log(lines.current.length);
    // if (lines.current.length < 1) return;

    cancelAnimationFrame(rafID);
    isAnimating.current = true;
    // lines.current.forEach

    const splittedLines = getLinesForAnimation(lines);

    let counter = 0;

    splittedLines.forEach((line) => {
      return drawPolygon(line, 1.5, () => {
        // isAnimating.current = false;
        // lines.current = [];
        // circles.current = [];

        draw();
        // const canvas = canvasRef.current;
        // const ctx = canvas.getContext("2d");
        // ctx.clearRect(0, 0, canvas.width, canvas.height);
        counter += 1;

        if (counter === splittedLines.length - 1) {
          isAnimating.current = false;
          lines.current = [];
          circles.current = [];
        }
      });
    });
  };

  const mouseMoveHandle = useCallback(
    (event) => {
      const { x, y } = getMousePosition(event);

      endPointX.current = x;
      endPointY.current = y;
      //   console.log("FROM DRAW", endPointX.current, endPointY.current);

      draw();
    },
    [draw, getMousePosition]
  );

  const mouseDownHandle = useCallback(
    (event) => {
      //   isDrawing.current = true;
      //   const { x, y } = getMousePosition(event);
      //   startPointX.current = x;
      //   startPointY.current = y;
      //   draw();
    },
    [draw, getMousePosition]
  );

  const mouseUpHandler = useCallback((event) => {
    if (event.which === 1) {
      if (isDrawing.current) {
        isDrawing.current = false;
        lines.current.push([
          [startPointX.current, startPointY.current],
          [endPointX.current, endPointY.current],
        ]);
        circles.current.push(...temporaryCircles.current);
      } else {
        isDrawing.current = true;
        const { x, y } = getMousePosition(event);
        startPointX.current = x;
        startPointY.current = y;
        draw();
      }
    } else if (event.which === 3 && isDrawing.current) {
      isDrawing.current = false;
      startPointX.current = -1;
      startPointY.current = -1;
      draw();
    }
  }, []);

  const contextMenuHandler = useCallback((event) => {
    event.preventDefault();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    canvas.addEventListener("mousemove", mouseMoveHandle);
    canvas.addEventListener("mousedown", mouseDownHandle);
    canvas.addEventListener("mouseup", mouseUpHandler);
    canvas.addEventListener("contextmenu", contextMenuHandler);

    //Our draw come here

    // initial draw
    draw();

    return () => {
      canvas.removeEventListener("mousemove", mouseMoveHandle);
      canvas.removeEventListener("mousedown", mouseDownHandle);
      canvas.removeEventListener("mouseup", mouseUpHandler);
      canvas.removeEventListener("contextmenu", contextMenuHandler);
    };
  }, [
    draw,
    mouseMoveHandle,
    mouseDownHandle,
    mouseUpHandler,
    contextMenuHandler,
  ]);

  return (
    <>
      <canvas ref={canvasRef} {...props} />
      <button onClick={collapseLines}>Collapse lines</button>
    </>
  );
};
