const mongoose = require('mongoose');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const { saveBase64Image, getImageUrl, deleteImageFile } = require('../utils/imageHelper');

// 1. Get all categories (populated with subcategories and supportedAttributes)
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .populate('supportedAttributes')
      .lean();

    const subcategories = await Subcategory.find().lean();

    // Map categories to include their formatted images, subcategories, and structure expected by frontend
    const formattedCategories = categories.map(cat => {
      // Find subcategories belonging to this category
      const subs = subcategories
        .filter(sub => sub.category.toString() === cat._id.toString())
        .map(sub => ({
          id: sub._id.toString(),
          _id: sub._id.toString(),
          name: sub.name,
          slug: sub.slug || '',
          image: getImageUrl(sub.image),
          rawImage: sub.image, // Keep raw path for editing reference
          products: [] // Seed products array for frontend catalog merge
        }));

      return {
        id: cat._id.toString(),
        _id: cat._id.toString(),
        name: cat.name,
        image: getImageUrl(cat.image),
        rawImage: cat.image, // Keep raw path for editing reference
        supportedAttributes: cat.supportedAttributes.map(attr => ({
          id: attr._id.toString(),
          _id: attr._id.toString(),
          name: attr.name,
          terms: attr.terms
        })),
        subcategories: subs
      };
    });

    res.status(200).json({
      success: true,
      data: formattedCategories
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 2. Create a Category
exports.createCategory = async (req, res) => {
  try {
    const { name, image, supportedAttributes } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Category "${name}" already exists`
      });
    }

    // Process photo/image if sent as Base64
    let savedImagePath = '';
    if (image) {
      savedImagePath = saveBase64Image(image, 'categories', 'category');
    }

    const category = await Category.create({
      name: name.trim(),
      image: savedImagePath,
      supportedAttributes: supportedAttributes || []
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 3. Update a Category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image, supportedAttributes } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    if (name && name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Category "${name}" already exists`
        });
      }
      category.name = name.trim();
    }

    // Handle image update if new base64 image is uploaded
    if (image && image.startsWith('data:image')) {
      if (category.image) {
        deleteImageFile(category.image);
      }
      category.image = saveBase64Image(image, 'categories', 'category');
    }

    if (supportedAttributes) {
      category.supportedAttributes = supportedAttributes;
    }

    await category.save();

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 4. Delete a Category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Delete category image physical file
    if (category.image) {
      deleteImageFile(category.image);
    }

    // Find and delete all subcategories belonging to this category
    const subcategories = await Subcategory.find({ category: id });
    for (const sub of subcategories) {
      if (sub.image) {
        deleteImageFile(sub.image);
      }
    }
    await Subcategory.deleteMany({ category: id });

    // Delete Category itself
    await Category.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Category and all associated subcategories deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 5. Create a Subcategory
exports.createSubcategory = async (req, res) => {
  try {
    const { name, image, categoryId } = req.body;

    if (!name || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory name and parent category ID are required'
      });
    }

    const parentCategory = await Category.findById(categoryId);
    if (!parentCategory) {
      return res.status(404).json({
        success: false,
        message: 'Parent Category not found'
      });
    }

    const existing = await Subcategory.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      category: categoryId
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Subcategory "${name}" already exists in this Category`
      });
    }

    // Process photo/image if sent as Base64
    let savedImagePath = '';
    if (image) {
      savedImagePath = saveBase64Image(image, 'subcategories', 'subcategory');
    }

    const subcategory = await Subcategory.create({
      name: name.trim(),
      image: savedImagePath,
      category: categoryId
    });

    res.status(201).json({
      success: true,
      data: subcategory
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 6. Update a Subcategory
exports.updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image } = req.body;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }

    if (name && name.trim().toLowerCase() !== subcategory.name.toLowerCase()) {
      const existing = await Subcategory.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        category: subcategory.category
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Subcategory "${name}" already exists in this Category`
        });
      }
      subcategory.name = name.trim();
    }

    // Handle image update if new base64 image is uploaded
    if (image && image.startsWith('data:image')) {
      if (subcategory.image) {
        deleteImageFile(subcategory.image);
      }
      subcategory.image = saveBase64Image(image, 'subcategories', 'subcategory');
    }

    await subcategory.save();

    res.status(200).json({
      success: true,
      data: subcategory
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 7. Delete a Subcategory
exports.deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }

    // Delete subcategory image physical file
    if (subcategory.image) {
      deleteImageFile(subcategory.image);
    }

    // Delete subcategory from DB
    await Subcategory.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 8. Get subcategory details including parent category name
exports.getSubcategoryDetails = async (req, res) => {
  try {
    const { id } = req.params;

    let query;
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      query = { slug: id };
    }

    const subcategory = await Subcategory.findOne(query).populate('category').lean();
    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        subcategoryName: subcategory.name,
        categoryName: subcategory.category ? subcategory.category.name : 'Shop'
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

