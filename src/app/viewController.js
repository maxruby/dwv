import {Index} from '../math/index';
import {Vector3D} from '../math/vector';
import {Point3D} from '../math/point';
import {isIdentityMat33} from '../math/matrix';
import {Size} from '../image/size';
import {Spacing} from '../image/spacing';
import {Image} from '../image/image';
import {Geometry} from '../image/geometry';
import {PlaneHelper} from '../image/planeHelper';
import {MaskSegmentHelper} from '../image/maskSegmentHelper';
import {
  getSliceIterator,
  getIteratorValues,
  getRegionSliceIterator,
  getVariableRegionSliceIterator
} from '../image/iterator';
import {ListenerHandler} from '../utils/listen';

// doc imports
/* eslint-disable no-unused-vars */
import {View} from '../image/view';
import {WindowLevel} from '../image/windowLevel';
import {Point, Point2D} from '../math/point';
/* eslint-enable no-unused-vars */

/**
 * View controller.
 */
export class ViewController {

  /**
   * Associated View.
   *
   * @type {View}
   */
  #view;

  /**
   * Associated data id.
   *
   * @type {string}
   */
  #dataId;

  /**
   * Plane helper.
   *
   * @type {PlaneHelper}
   */
  #planeHelper;

  /**
   * Mask segment helper.
   *
   * @type {MaskSegmentHelper}
   */
  #maskSegmentHelper;

  /**
   * Colour map name.
   * Defaults to 'plain' as defined in Views' default.
   *
   * #type {string}
   */
  #colourMapName = 'plain';

  /**
   * Third dimension player ID (created by setInterval).
   *
   * @type {number|undefined}
   */
  #playerID;

  /**
   * @param {View} view The associated view.
   * @param {string} dataId The associated data id.
   */
  constructor(view, dataId) {
    // check view
    if (typeof view.getImage() === 'undefined') {
      throw new Error('View does not have an image, cannot setup controller');
    }

    this.#view = view;
    this.#dataId = dataId;

    // setup the plane helper
    this.#planeHelper = new PlaneHelper(
      view.getImage().getGeometry().getRealSpacing(),
      view.getImage().getGeometry().getOrientation(),
      view.getOrientation()
    );

    // mask segment helper
    if (view.getImage().getMeta().Modality === 'SEG') {
      this.#maskSegmentHelper =
        new MaskSegmentHelper(view.getImage());
    }
  }

  /**
   * Listener handler.
   *
   * @type {ListenerHandler}
   */
  #listenerHandler = new ListenerHandler();

  /**
   * Get the plane helper.
   *
   * @returns {PlaneHelper} The helper.
   */
  getPlaneHelper() {
    return this.#planeHelper;
  }

  /**
   * Check is the associated image is a mask.
   *
   * @returns {boolean} True if the associated image is a mask.
   */
  isMask() {
    return typeof this.#maskSegmentHelper !== 'undefined';
  }

  /**
   * Get the mask segment helper.
   *
   * @returns {MaskSegmentHelper} The helper.
   */
  getMaskSegmentHelper() {
    return this.#maskSegmentHelper;
  }

  /**
   * Apply the hidden segments list by setting
   * the corresponding alpha function.
   */
  applyHiddenSegments() {
    if (this.isMask) {
      this.setViewAlphaFunction(this.#maskSegmentHelper.getAlphaFunc());
    }
  }

  /**
   * Delete a segment.
   *
   * @param {number} segmentNumber The segment number.
   * @param {Function} exeCallback The post execution callback.
   */
  deleteSegment(segmentNumber, exeCallback) {
    if (this.isMask) {
      this.#maskSegmentHelper.deleteSegment(
        segmentNumber, this.#fireEvent, exeCallback);
    }
  }

  /**
   * Initialise the controller.
   */
  initialise() {
    // set window/level to first preset
    this.setWindowLevelPresetById(0);
    // default position
    this.setCurrentPosition(this.getPositionFromPlanePoint(
      new Point2D(0, 0)
    ));
  }

  /**
   * Get the image modality.
   *
   * @returns {string} The modality.
   */
  getModality() {
    return this.#view.getImage().getMeta().Modality;
  }

  /**
   * Get the window/level presets names.
   *
   * @returns {string[]} The presets names.
   */
  getWindowLevelPresetsNames() {
    return this.#view.getWindowPresetsNames();
  }

  /**
   * Add window/level presets to the view.
   *
   * @param {object} presets A preset object.
   * @returns {object} The list of presets.
   */
  addWindowLevelPresets(presets) {
    return this.#view.addWindowPresets(presets);
  }

  /**
   * Set the window level to the preset with the input name.
   *
   * @param {string} name The name of the preset to activate.
   */
  setWindowLevelPreset(name) {
    this.#view.setWindowLevelPreset(name);
  }

  /**
   * Set the window level to the preset with the input id.
   *
   * @param {number} id The id of the preset to activate.
   */
  setWindowLevelPresetById(id) {
    this.#view.setWindowLevelPresetById(id);
  }

  /**
   * Check if the controller is playing.
   *
   * @returns {boolean} True if the controler is playing.
   */
  isPlaying() {
    return (typeof this.#playerID !== 'undefined');
  }

  /**
   * Get the current position.
   *
   * @returns {Point} The position.
   */
  getCurrentPosition() {
    return this.#view.getCurrentPosition();
  }

  /**
   * Get the current index.
   *
   * @returns {Index} The current index.
   */
  getCurrentIndex() {
    return this.#view.getCurrentIndex();
  }

  /**
   * Get the current oriented index.
   *
   * @returns {Index} The index.
   */
  getCurrentOrientedIndex() {
    let res = this.#view.getCurrentIndex();
    if (typeof this.#view.getOrientation() !== 'undefined') {
      // view oriented => image de-oriented
      const vector = this.#planeHelper.getImageDeOrientedVector3D(
        new Vector3D(res.get(0), res.get(1), res.get(2))
      );
      res = new Index([
        vector.getX(), vector.getY(), vector.getZ()
      ]);
    }
    return res;
  }

  /**
   * Get the scroll index.
   *
   * @returns {number} The index.
   */
  getScrollIndex() {
    return this.#view.getScrollIndex();
  }

  /**
   * Get the current scroll index value.
   *
   * @returns {object} The value.
   */
  getCurrentScrollIndexValue() {
    return this.#view.getCurrentIndex().get(this.#view.getScrollIndex());
  }

  /**
   * Get the first origin or at a given position.
   *
   * @param {Point} [position] Opitonal position.
   * @returns {Point3D} The origin.
   */
  getOrigin(position) {
    return this.#view.getOrigin(position);
  }

  /**
   * Get the current scroll position value.
   *
   * @returns {object} The value.
   */
  getCurrentScrollPosition() {
    const scrollIndex = this.#view.getScrollIndex();
    return this.#view.getCurrentPosition().get(scrollIndex);
  }

  /**
   * Generate display image data to be given to a canvas.
   *
   * @param {ImageData} array The array to fill in.
   * @param {Index} [index] Optional index at which to generate,
   *   otherwise generates at current index.
   */
  generateImageData(array, index) {
    this.#view.generateImageData(array, index);
  }

  /**
   * Set the associated image.
   *
   * @param {Image} img The associated image.
   * @param {string} dataId The data id of the image.
   */
  setImage(img, dataId) {
    this.#view.setImage(img);
    this.#dataId = dataId;
  }

  /**
   * Get the current view (2D) spacing.
   *
   * @returns {number[]} The spacing as a 2D array.
   */
  get2DSpacing() {
    const spacing = this.#view.getImage().getGeometry().getSpacing(
      this.#view.getOrientation());
    return [spacing.get(0), spacing.get(1)];
  }

  /**
   * Get the image rescaled value at the input position.
   *
   * @param {Point} position the input position.
   * @returns {number|undefined} The image value or undefined if out of bounds
   *   or no quantifiable (for ex RGB).
   */
  getRescaledImageValue(position) {
    const image = this.#view.getImage();
    if (!image.canQuantify()) {
      return;
    }
    const geometry = image.getGeometry();
    const index = geometry.worldToIndex(position);
    let value;
    if (geometry.isIndexInBounds(index)) {
      value = image.getRescaledValueAtIndex(index);
    }
    return value;
  }

  /**
   * Get the image pixel unit.
   *
   * @returns {string} The unit
   */
  getPixelUnit() {
    return this.#view.getImage().getMeta().pixelUnit;
  }

  /**
   * Get some values from the associated image in a region.
   *
   * @param {Point2D} min Minimum point.
   * @param {Point2D} max Maximum point.
   * @returns {Array} A list of values.
   */
  getImageRegionValues(min, max) {
    let image = this.#view.getImage();
    const orientation = this.#view.getOrientation();
    let position = this.getCurrentIndex();
    let rescaled = true;

    // created oriented slice if needed
    if (!isIdentityMat33(orientation)) {
      // generate slice values
      const sliceIter = getSliceIterator(
        image,
        position,
        rescaled,
        orientation
      );
      const sliceValues = getIteratorValues(sliceIter);
      // oriented geometry
      const orientedSize = image.getGeometry().getSize(orientation);
      const sizeValues = orientedSize.getValues();
      sizeValues[2] = 1;
      const sliceSize = new Size(sizeValues);
      const orientedSpacing = image.getGeometry().getSpacing(orientation);
      const spacingValues = orientedSpacing.getValues();
      spacingValues[2] = 1;
      const sliceSpacing = new Spacing(spacingValues);
      const sliceOrigin = new Point3D(0, 0, 0);
      const sliceGeometry =
        new Geometry(sliceOrigin, sliceSize, sliceSpacing);
      // slice image
      // @ts-ignore
      image = new Image(sliceGeometry, sliceValues);
      // update position
      position = new Index([0, 0, 0]);
      rescaled = false;
    }

    // get region values
    const iter = getRegionSliceIterator(
      image, position, rescaled, min, max);
    let values = [];
    if (iter) {
      values = getIteratorValues(iter);
    }
    return values;
  }

  /**
   * Get some values from the associated image in variable regions.
   *
   * @param {Array} regions A list of regions.
   * @returns {Array} A list of values.
   */
  getImageVariableRegionValues(regions) {
    const iter = getVariableRegionSliceIterator(
      this.#view.getImage(),
      this.getCurrentIndex(),
      true, regions
    );
    let values = [];
    if (iter) {
      values = getIteratorValues(iter);
    }
    return values;
  }

  /**
   * Can the image values be quantified?
   *
   * @returns {boolean} True if possible.
   */
  canQuantifyImage() {
    return this.#view.getImage().canQuantify();
  }

  /**
   * Can window and level be applied to the data?
   *
   * @returns {boolean} True if possible.
   * @deprecated Please use isMonochrome instead.
   */
  canWindowLevel() {
    return this.isMonochrome();
  }

  /**
   * Is the data monochrome.
   *
   * @returns {boolean} True if the data is monochrome.
   */
  isMonochrome() {
    return this.#view.getImage().isMonochrome();
  }

  /**
   * Can the data be scrolled?
   *
   * @returns {boolean} True if the data has either the third dimension
   * or above greater than one.
   */
  canScroll() {
    return this.#view.getImage().canScroll(this.#view.getOrientation());
  }

  /**
   * Get the image size.
   *
   * @returns {Size} The size.
   */
  getImageSize() {
    return this.#view.getImage().getGeometry().getSize(
      this.#view.getOrientation());
  }

  /**
   * Get the image world (mm) 2D size.
   *
   * @returns {object} The 2D size as {x,y}.
   */
  getImageWorldSize() {
    const geometry = this.#view.getImage().getGeometry();
    const size = geometry.getSize(this.#view.getOrientation()).get2D();
    const spacing = geometry.getSpacing(this.#view.getOrientation()).get2D();
    return {
      x: size.x * spacing.x,
      y: size.y * spacing.y
    };
  }

  /**
   * Get the image rescaled data range.
   *
   * @returns {object} The range as {min, max}.
   */
  getImageRescaledDataRange() {
    return this.#view.getImage().getRescaledDataRange();
  }

  /**
   * Compare the input meta data to the associated image one.
   *
   * @param {object} meta The meta data.
   * @returns {boolean} True if the associated image has equal meta data.
   */
  equalImageMeta(meta) {
    const imageMeta = this.#view.getImage().getMeta();
    // loop through input meta keys
    const metaKeys = Object.keys(meta);
    for (let i = 0; i < metaKeys.length; ++i) {
      const metaKey = metaKeys[i];
      if (typeof imageMeta[metaKey] === 'undefined') {
        return false;
      }
      if (imageMeta[metaKey] !== meta[metaKey]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check is the provided position can be set.
   *
   * @param {Point} position The position.
   * @returns {boolean} True is the position is in bounds.
   */
  canSetPosition(position) {
    return this.#view.canSetPosition(position);
  }

  /**
   * Set the current position.
   *
   * @param {Point} pos The position.
   * @param {boolean} [silent] If true, does not fire a
   *   positionchange event.
   * @returns {boolean} False if not in bounds.
   */
  setCurrentPosition(pos, silent) {
    return this.#view.setCurrentPosition(pos, silent);
  }

  /**
   * Get a world position from a 2D plane position.
   *
   * @param {Point2D} point2D The input point.
   * @returns {Point} The associated position.
   */
  getPositionFromPlanePoint(point2D) {
    // keep third direction
    const k = this.getCurrentScrollIndexValue();
    const planePoint = new Point3D(point2D.getX(), point2D.getY(), k);
    // de-orient
    const point = this.#planeHelper.getImageOrientedPoint3D(planePoint);
    // ~indexToWorld to not loose precision
    const geometry = this.#view.getImage().getGeometry();
    const point3D = geometry.pointToWorld(point);
    // merge with current position to keep extra dimensions
    return this.getCurrentPosition().mergeWith3D(point3D);
  }

  /**
   * Get a 2D plane position from a world position.
   *
   * @param {Point} point The 3D position.
   * @returns {Point2D} The 2D position.
   */
  getPlanePositionFromPosition(point) {
    // orient
    const geometry = this.#view.getImage().getGeometry();
    // ~worldToIndex to not loose precision
    const point3D = geometry.worldToPoint(point);
    const planePoint = this.#planeHelper.getImageDeOrientedPoint3D(point3D);
    // return
    return new Point2D(
      planePoint.getX(),
      planePoint.getY(),
    );
  }

  /**
   * Set the current index.
   *
   * @param {Index} index The index.
   * @param {boolean} [silent] If true, does not fire a positionchange event.
   * @returns {boolean} False if not in bounds.
   */
  setCurrentIndex(index, silent) {
    return this.#view.setCurrentIndex(index, silent);
  }

  /**
   * Get a plane 3D position from a plane 2D position: does not compensate
   *   for the image origin. Needed for setting the scale center...
   *
   * @param {Point2D} point2D The 2D position.
   * @returns {Point3D} The 3D point.
   */
  getPlanePositionFromPlanePoint(point2D) {
    // keep third direction
    const k = this.getCurrentScrollIndexValue();
    const planePoint = new Point3D(point2D.getX(), point2D.getY(), k);
    // de-orient
    const point = this.#planeHelper.getTargetDeOrientedPoint3D(planePoint);
    // ~indexToWorld to not loose precision
    const geometry = this.#view.getImage().getGeometry();
    const spacing = geometry.getRealSpacing();
    return new Point3D(
      point.getX() * spacing.get(0),
      point.getY() * spacing.get(1),
      point.getZ() * spacing.get(2));
  }

  /**
   * Get a 3D offset from a plane one.
   *
   * @param {object} offset2D The plane offset as {x,y}.
   * @returns {Vector3D} The 3D world offset.
   */
  getOffset3DFromPlaneOffset(offset2D) {
    return this.#planeHelper.getOffset3DFromPlaneOffset(offset2D);
  }

  /**
   * Increment the provided dimension.
   *
   * @param {number} dim The dimension to increment.
   * @param {boolean} [silent] Do not send event.
   * @returns {boolean} False if not in bounds.
   */
  incrementIndex(dim, silent) {
    return this.#view.incrementIndex(dim, silent);
  }

  /**
   * Decrement the provided dimension.
   *
   * @param {number} dim The dimension to increment.
   * @param {boolean} [silent] Do not send event.
   * @returns {boolean} False if not in bounds.
   */
  decrementIndex(dim, silent) {
    return this.#view.decrementIndex(dim, silent);
  }

  /**
   * Decrement the scroll dimension index.
   *
   * @param {boolean} [silent] Do not send event.
   * @returns {boolean} False if not in bounds.
   */
  decrementScrollIndex(silent) {
    return this.#view.decrementScrollIndex(silent);
  }

  /**
   * Increment the scroll dimension index.
   *
   * @param {boolean} [silent] Do not send event.
   * @returns {boolean} False if not in bounds.
   */
  incrementScrollIndex(silent) {
    return this.#view.incrementScrollIndex(silent);
  }

  /**
   * Scroll play: loop through all slices.
   */
  play() {
    // ensure data is scrollable: dim >= 3
    if (!this.canScroll()) {
      return;
    }
    if (typeof this.#playerID === 'undefined') {
      const image = this.#view.getImage();
      const recommendedDisplayFrameRate =
        image.getMeta().RecommendedDisplayFrameRate;
      const milliseconds = this.#view.getPlaybackMilliseconds(
        recommendedDisplayFrameRate);
      const size = image.getGeometry().getSize();
      const canScroll3D = size.canScroll3D();

      this.#playerID = window.setInterval(() => {
        let canDoMore = false;
        if (canScroll3D) {
          canDoMore = this.incrementScrollIndex();
        } else {
          canDoMore = this.incrementIndex(3);
        }
        // end of scroll, loop back
        if (!canDoMore) {
          const pos1 = this.getCurrentIndex();
          const values = pos1.getValues();
          const orientation = this.#view.getOrientation();
          if (canScroll3D) {
            values[orientation.getThirdColMajorDirection()] = 0;
          } else {
            values[3] = 0;
          }
          const index = new Index(values);
          const geometry = this.#view.getImage().getGeometry();
          this.setCurrentPosition(geometry.indexToWorld(index));
        }
      }, milliseconds);
    } else {
      this.stop();
    }
  }

  /**
   * Stop scroll playing.
   */
  stop() {
    if (typeof this.#playerID !== 'undefined') {
      clearInterval(this.#playerID);
      this.#playerID = undefined;
    }
  }

  /**
   * Get the window/level.
   *
   * @returns {WindowLevel} The window and level.
   */
  getWindowLevel() {
    return this.#view.getWindowLevel();
  }

  /**
   * Get the current window level preset name.
   *
   * @returns {string} The preset name.
   */
  getCurrentWindowPresetName() {
    return this.#view.getCurrentWindowPresetName();
  }

  /**
   * Set the window and level.
   *
   * @param {WindowLevel} wl The window and level.
   */
  setWindowLevel(wl) {
    this.#view.setWindowLevel(wl);
  }

  /**
   * Get the colour map.
   *
   * @returns {string} The colour map name.
   */
  getColourMap() {
    return this.#view.getColourMap();
  }

  /**
   * Set the colour map.
   *
   * @param {string} name The colour map name.
   */
  setColourMap(name) {
    this.#view.setColourMap(name);
  }

  /**
   * @callback alphaFn
   * @param {number[]|number} value The pixel value.
   * @param {number} index The values' index.
   * @returns {number} The opacity of the input value.
   */

  /**
   * Set the view per value alpha function.
   *
   * @param {alphaFn} func The function.
   */
  setViewAlphaFunction(func) {
    this.#view.setAlphaFunction(func);
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {Function} callback The function associated with the provided
   *   event type, will be called with the fired event.
   */
  addEventListener(type, callback) {
    this.#listenerHandler.add(type, callback);
  }

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {Function} callback The function associated with the provided
   *   event type.
   */
  removeEventListener(type, callback) {
    this.#listenerHandler.remove(type, callback);
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   */
  #fireEvent = (event) => {
    event.dataid = this.#dataId;
    this.#listenerHandler.fireEvent(event);
  };

} // class ViewController
